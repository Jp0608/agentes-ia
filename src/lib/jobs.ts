import "server-only";
import { q } from "./db";
import { fixAppt, getAppointment, nextFreeSlots, setStatus, type Appointment, type AppointmentWithClient, type Client } from "./booking";
import { findNiche } from "./niches";
import { agentOn, type Settings } from "./settings";
import { tenantId } from "./tenant";
import { addDays, brl, dayKey, hourLabel, parts, shortName, whenLabel, zoned } from "./time";
import { logActivity, send, sendOwner } from "./whatsapp";

/**
 * Agentes que trabalham sozinhos, chamados pelo /api/cron a cada 10 minutos (e pelo botão
 * "Rodar agora" do painel). Cada um olha o banco, decide o que está na hora e manda as mensagens.
 * Com force, ignora a janela de horário (útil na demonstração).
 * Tudo aqui roda no tenant atual (sessão do painel, ou withTenant no cron e no webhook).
 */
const first = (name: string) => shortName(name);
const hi = (name: string) => (name ? `Oi, ${first(name)}!` : "Oi!");

/** "Corte" → "corte", "RPG" fica como está. */
const lower = (term: string) => {
  const t = term.trim();
  return /^.[A-ZÀ-Ú]/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1);
};
const MASC_A = /^(dia|mapa|programa|sistema|problema|tema|clima|drama|idioma|pijama|cinema|check)$/;
const MASC_AO = /^(botão|cartão|pão|feijão|cão|chão|balcão|sabão|mamão|algodão|bastão)$/;
/** Gênero pela primeira palavra: "Limpeza de pele" e "Pé e mão" pedem "a" e "o", não pela última. */
export function feminine(term: string) {
  const w = lower(term).split(/[\s\-(]+/)[0].toLowerCase();
  if (MASC_A.test(w) || MASC_AO.test(w)) return false;
  return /(a|ã|ão|gem|dade|ise)$/.test(w);
}
/** "o seu corte", "a sua limpeza de pele". */
const oSeu = (term: string) => `${feminine(term) ? "a sua" : "o seu"} ${lower(term)}`;

async function once(key: string) {
  const rows = await q("insert into job_runs (tenant_id, key) values ($1, $2) on conflict (tenant_id, key) do nothing returning key", [await tenantId(), key]);
  return rows.length > 0;
}

type Ctx = { s: Settings; now: Date; force: boolean };
type Report = Record<string, number>;

/* ---------- Lembretes ---------- */

async function reminders({ s, now, force }: Ctx) {
  const tz = s.timezone;
  const today = dayKey(now, tz);
  const tomorrow = addDays(today, 1);
  const hour = parts(now, tz).h;
  const rows = (
    await q<AppointmentWithClient>(
      `select a.*, c.name as client_name, c.phone as client_phone, c.simulated as client_simulated
       from appointments a join clients c on c.id = a.client_id
       where a.tenant_id = $3 and a.status = 'marcado' and a.reminder_sent_at is null and a.starts_at > $1 and a.starts_at < $2`,
      [new Date(now.getTime() + 60 * 60000), new Date(now.getTime() + 36 * 3600_000), await tenantId()],
    )
  ).map(fixAppt);
  let n = 0;
  for (const a of rows) {
    const day = dayKey(a.starts_at, tz);
    const due =
      force ||
      (day === tomorrow && hour >= 18) ||
      (day === today && a.starts_at.getTime() - now.getTime() <= 3 * 3600_000) ||
      (day === today && a.created_at.getTime() < zoned(today, "00:00", tz).getTime());
    if (!due) continue;
    // Marca antes de mandar: duas rodadas ao mesmo tempo (cron e webhook) não mandam o lembrete duas vezes.
    const claimed = await q("update appointments set reminder_sent_at = now() where id = $1 and tenant_id = $2 and reminder_sent_at is null returning id", [
      a.id,
      await tenantId(),
    ]);
    if (!claimed.length) continue;
    const text = `${hi(a.client_name)} Passando para lembrar ${feminine(a.service) ? "da sua" : "do seu"} ${lower(a.service)} ${whenLabel(a.starts_at, tz, now)}.${s.address ? `\n📍 ${s.address}` : ""}\nResponde 1 para confirmar ou 2 para cancelar.`;
    await send(a.client_phone, text, "lembretes", { simulated: a.client_simulated });
    await logActivity("lembretes", `Lembrete para ${a.client_name || a.client_phone}: ${a.service} ${whenLabel(a.starts_at, tz, now)}`, a.client_phone);
    n++;
  }
  return n;
}

/** Resposta 1 ou 2 a um lembrete. Devolve true se tratou a mensagem. */
export async function handleReminderReply(s: Settings, c: Client, text: string, now = new Date()) {
  const t = text.trim().toLowerCase();
  const yes = /^(1|sim|confirmo|confirmado|confirmar)\b/.test(t);
  const no = /^(2|cancelar|cancela|não vou|nao vou)\b/.test(t);
  if (!yes && !no) return false;
  const rows = (
    await q<Appointment>(
      `select * from appointments where tenant_id = $4 and client_id = $1 and status = 'marcado' and reminder_sent_at > $2 and starts_at > $3
       order by starts_at limit 1`,
      [c.id, new Date(now.getTime() - 36 * 3600_000), now, await tenantId()],
    )
  ).map(fixAppt);
  const a = rows[0];
  if (!a) return false;
  const tz = s.timezone;
  if (yes) {
    await setStatus(a.id, "confirmado");
    await send(c.phone, `Confirmado! Te esperamos ${whenLabel(a.starts_at, tz, now)}. 👍`, "lembretes", { simulated: c.simulated });
    await logActivity("lembretes", `${c.name || c.phone} confirmou ${a.service} ${whenLabel(a.starts_at, tz, now)}`, c.phone);
    return true;
  }
  await setStatus(a.id, "cancelado");
  const next = await nextFreeSlots(s, a.service, { fromDay: addDays(dayKey(a.starts_at, tz), 1), now, limit: 2 });
  await send(
    c.phone,
    `Cancelado, sem problema. ${next.length ? `Quer remarcar? Tenho ${next.map((x) => whenLabel(x.start, tz, now)).join(" ou ")}.` : "Quando quiser remarcar, é só me chamar."}`,
    "lembretes",
    { simulated: c.simulated },
  );
  await logActivity("lembretes", `${c.name || c.phone} cancelou ${a.service} pelo lembrete`, c.phone);
  await offerFreedSlot(s, a, now);
  return true;
}

/* ---------- Lista de espera ---------- */

/** Uma vaga abriu (cancelamento ou remarcação): oferece para a primeira pessoa da lista. */
export async function offerFreedSlot(s: Settings, a: Pick<Appointment, "service" | "starts_at" | "resource">, now = new Date()) {
  if (!agentOn(s, "espera")) return false;
  if (a.starts_at.getTime() - now.getTime() < 60 * 60000) return false;
  const t = await tenantId();
  const rows = await q<{ id: number; client_id: number; name: string; phone: string; simulated: boolean; service: string }>(
    `select w.id, w.client_id, c.name, c.phone, c.simulated, w.service from waitlist w join clients c on c.id = w.client_id
     where w.tenant_id = $2 and w.status = 'esperando' and lower(w.service) = lower($1) order by w.created_at limit 1`,
    [a.service, t],
  );
  const w = rows[0] ?? (
    await q<{ id: number; client_id: number; name: string; phone: string; simulated: boolean; service: string }>(
      `select w.id, w.client_id, c.name, c.phone, c.simulated, w.service from waitlist w join clients c on c.id = w.client_id
       where w.tenant_id = $1 and w.status = 'esperando' order by w.created_at limit 1`,
      [t],
    )
  )[0];
  if (!w) return false;
  const when = whenLabel(a.starts_at, s.timezone, now);
  await send(w.phone, `${hi(w.name)} Abriu uma vaga para ${lower(a.service)} ${when}. Quer? É só responder aqui que eu já marco.`, "espera", { simulated: w.simulated });
  await q("update waitlist set status = 'oferecido', offered_at = now() where id = $1 and tenant_id = $2", [w.id, t]);
  await logActivity("espera", `Vaga de ${when} (${a.service}) oferecida para ${w.name || w.phone}`, w.phone);
  return true;
}

/* ---------- Faltas ---------- */

/** Marca falta e manda a mensagem na hora. */
export async function markNoShow(s: Settings, id: number, now = new Date()) {
  const a = await getAppointment(id);
  if (!a) return;
  await setStatus(id, "faltou");
  await logActivity("faltas", `${a.client_name || a.client_phone} faltou (${a.service}, ${hourLabel(a.starts_at, s.timezone)})`, a.client_phone);
  if (!agentOn(s, "faltas")) return;
  const tz = s.timezone;
  const next = await nextFreeSlots(s, a.service, { now, limit: 2 });
  await send(
    a.client_phone,
    `${hi(a.client_name)} Sentimos sua falta ${whenLabel(a.starts_at, tz, now)}. Aconteceu alguma coisa? ${next.length ? `Se quiser remarcar, tenho ${next.map((x) => whenLabel(x.start, tz, now)).join(" ou ")}.` : "Quando quiser remarcar, é só me chamar."}`,
    "faltas",
    { simulated: a.client_simulated },
  );
  const count = await q<{ n: string }>("select count(*) as n from appointments where tenant_id = $2 and client_id = $1 and status = 'faltou'", [
    a.client_id,
    await tenantId(),
  ]);
  if (Number(count[0]?.n) >= 3) {
    await sendOwner(s.ownerPhone, `⚠️ ${a.client_name || a.client_phone} faltou pela ${count[0].n}ª vez. Vale pedir sinal na próxima.`, "faltas");
  }
}

/* ---------- Concluir atendimentos que já passaram ---------- */

async function autoComplete({ now }: Ctx) {
  const rows = await q("update appointments set status = 'concluido' where tenant_id = $2 and status in ('marcado','confirmado') and ends_at < $1 returning id", [
    new Date(now.getTime() - 30 * 60000),
    await tenantId(),
  ]);
  return rows.length;
}

/* ---------- Avaliações ---------- */

async function reviews({ s, now, force }: Ctx) {
  const tz = s.timezone;
  if (!force && parts(now, tz).h < 10) return 0;
  const todayStart = zoned(dayKey(now, tz), "00:00", tz);
  const rows = (
    await q<AppointmentWithClient>(
      `select a.*, c.name as client_name, c.phone as client_phone, c.simulated as client_simulated
       from appointments a join clients c on c.id = a.client_id
       where a.tenant_id = $4 and a.status = 'concluido' and a.review_asked_at is null and a.ends_at > $1 and a.ends_at < $2
       and not exists (select 1 from appointments b where b.tenant_id = a.tenant_id and b.client_id = a.client_id and b.review_asked_at > $3)`,
      [new Date(now.getTime() - 4 * 86400_000), force ? now : todayStart, new Date(now.getTime() - 20 * 86400_000), await tenantId()],
    )
  ).map(fixAppt);
  let n = 0;
  const seen = new Set<number>();
  for (const a of rows) {
    if (seen.has(a.client_id)) continue;
    seen.add(a.client_id);
    const claimed = await q("update appointments set review_asked_at = now() where id = $1 and tenant_id = $2 and review_asked_at is null returning id", [
      a.id,
      await tenantId(),
    ]);
    if (!claimed.length) continue;
    const visit = findNiche(s.niche).visit;
    const yesterday = dayKey(a.starts_at, tz) === addDays(dayKey(now, tz), -1);
    await send(
      a.client_phone,
      `${hi(a.client_name)} Obrigado pela preferência! Como foi ${oSeu(visit)}${yesterday ? " de ontem" : ""}? Me dá uma nota de 1 a 5.`,
      "avaliacoes",
      { simulated: a.client_simulated },
    );
    await logActivity("avaliacoes", `Pediu nota a ${a.client_name || a.client_phone} (${a.service})`, a.client_phone);
    n++;
  }
  return n;
}

/** Nota pendente: resposta curta só com o número vai direto, sem passar pela IA. */
export async function pendingReview(c: Client, now = new Date()) {
  const rows = await q<{ id: number }>(
    "select id from appointments where tenant_id = $3 and client_id = $1 and review_asked_at > $2 and review_score is null limit 1",
    [c.id, new Date(now.getTime() - 3 * 86400_000), await tenantId()],
  );
  return rows.length > 0;
}

/* ---------- Retornos ---------- */

type Due = { id: number; name: string; phone: string; simulated: boolean; service: string; last_end: Date; last_return_at: Date | null };

export async function overdueClients(s: Settings, now = new Date()) {
  const rows = await q<Due>(
    `select c.id, c.name, c.phone, c.simulated, c.last_return_at, last.service, last.ends_at as last_end
     from clients c
     join lateral (select service, ends_at from appointments where tenant_id = c.tenant_id and client_id = c.id and status = 'concluido' order by ends_at desc limit 1) last on true
     where c.tenant_id = $3 and c.opt_out = false and last.ends_at < $1
       and not exists (select 1 from appointments f where f.tenant_id = c.tenant_id and f.client_id = c.id and f.starts_at > $2 and f.status in ('marcado','confirmado'))
     order by last.ends_at`,
    [new Date(now.getTime() - s.returnDays * 86400_000), now, await tenantId()],
  );
  return rows.map((r) => ({ ...r, id: Number(r.id), last_end: new Date(r.last_end), last_return_at: r.last_return_at ? new Date(r.last_return_at) : null }));
}

async function returns({ s, now, force }: Ctx) {
  const tz = s.timezone;
  const h = parts(now, tz).h;
  if (!force && (h < 9 || h >= 11)) return 0;
  const due = (await overdueClients(s, now)).filter((c) => !c.last_return_at || c.last_return_at.getTime() < now.getTime() - 30 * 86400_000);
  let n = 0;
  for (const c of due.slice(0, 20)) {
    const days = Math.round((now.getTime() - c.last_end.getTime()) / 86400_000);
    const slot = (await nextFreeSlots(s, c.service, { now, limit: 1, fromDay: addDays(dayKey(now, tz), 1) }))[0];
    const offer = slot ? ` Tenho ${whenLabel(slot.start, tz, now)}, posso marcar?` : " Quer que eu veja um horário?";
    const since = days >= 150 ? `${Math.round(days / 30)} meses` : `${days} dias`;
    const claimed = await q(
      "update clients set last_return_at = now() where id = $1 and tenant_id = $2 and (last_return_at is null or last_return_at < $3) returning id",
      [c.id, await tenantId(), new Date(now.getTime() - 30 * 86400_000)],
    );
    if (!claimed.length) continue;
    const last = feminine(c.service) ? "a sua última" : "o seu último";
    await send(c.phone, `${hi(c.name)} Já faz ${since} desde ${last} ${lower(c.service)}.${offer}`, "retornos", { simulated: c.simulated });
    await logActivity("retornos", `Chamou ${c.name || c.phone} de volta (${c.service}, ${since})`, c.phone);
    n++;
  }
  return n;
}

/* ---------- Orçamentos ---------- */

async function quoteFollowups({ s, now, force }: Ctx) {
  const h = parts(now, s.timezone).h;
  if (!force && (h < 9 || h >= 19)) return 0;
  const rows = await q<{ id: number; title: string; total: string; followups: number; sent_at: Date; name: string; phone: string; simulated: boolean }>(
    `select qt.id, qt.title, qt.total, qt.followups, qt.sent_at, c.name, c.phone, c.simulated
     from quotes qt join clients c on c.id = qt.client_id
     where qt.tenant_id = $3 and qt.status = 'enviado' and ((qt.followups = 0 and qt.sent_at < $1) or (qt.followups = 1 and qt.sent_at < $2))`,
    [new Date(now.getTime() - (force ? 0 : 3 * 86400_000)), new Date(now.getTime() - (force ? 0 : 10 * 86400_000)), await tenantId()],
  );
  let n = 0;
  for (const r of rows) {
    const text =
      r.followups === 0
        ? `${hi(r.name)} Ficou alguma dúvida sobre o orçamento de ${r.title}? Se quiser, já reservo o primeiro horário para você.`
        : `${hi(r.name)} Passando uma última vez sobre o orçamento de ${r.title}. Se mudar de ideia, é só me chamar aqui.`;
    const claimed = await q(
      "update quotes set followups = followups + 1, last_followup_at = now() where id = $1 and tenant_id = $2 and followups = $3 returning id",
      [r.id, await tenantId(), r.followups],
    );
    if (!claimed.length) continue;
    await send(r.phone, text, "orcamentos", { simulated: r.simulated });
    await logActivity("orcamentos", `${r.followups === 0 ? "Retorno do 3º dia" : "Último retorno"} do orçamento "${r.title}" para ${r.name || r.phone}`, r.phone);
    n++;
  }
  return n;
}

/* ---------- Página da manhã ---------- */

export async function morningStats(s: Settings, now = new Date()) {
  const tz = s.timezone;
  const today = dayKey(now, tz);
  const start = zoned(today, "00:00", tz);
  const end = zoned(addDays(today, 1), "00:00", tz);
  const yStart = zoned(addDays(today, -1), "00:00", tz);
  const t = await tenantId();
  const todayRows = (
    await q<Appointment>(
      "select * from appointments where tenant_id = $3 and starts_at >= $1 and starts_at < $2 and status in ('marcado','confirmado','concluido') order by starts_at",
      [start, end, t],
    )
  ).map(fixAppt);
  const lost = await q<{ status: string; n: string; total: string }>(
    `select status, count(*) as n, coalesce(sum(price), 0) as total from appointments
     where tenant_id = $3 and starts_at >= $1 and starts_at < $2 and status in ('faltou','cancelado')
       and not exists (select 1 from appointments r where r.tenant_id = appointments.tenant_id and r.status in ('marcado','confirmado','concluido') and r.starts_at = appointments.starts_at and r.resource = appointments.resource)
     group by status`,
    [yStart, start, t],
  );
  const overdue = await overdueClients(s, now);
  const called = overdue.filter((c) => c.last_return_at && c.last_return_at.getTime() > now.getTime() - 30 * 86400_000).length;
  const quotes = await q<{ n: string; total: string }>("select count(*) as n, coalesce(sum(total), 0) as total from quotes where tenant_id = $1 and status = 'enviado'", [t]);
  const sum = (st: string) => lost.find((l) => l.status === st);
  return {
    booked: todayRows.length,
    firstAt: todayRows[0]?.starts_at ?? null,
    confirmed: todayRows.filter((a) => a.status === "confirmado").length,
    overdue: overdue.length,
    called,
    lostValue: lost.reduce((a, l) => a + Number(l.total), 0),
    noShows: Number(sum("faltou")?.n ?? 0),
    cancels: Number(sum("cancelado")?.n ?? 0),
    openQuotes: Number(quotes[0]?.n ?? 0),
    openQuotesValue: Number(quotes[0]?.total ?? 0),
  };
}

export function morningText(s: Settings, m: Awaited<ReturnType<typeof morningStats>>) {
  const tz = s.timezone;
  return [
    `☀️ Bom dia${s.ownerName ? `, ${first(s.ownerName)}` : ""}! Sua página da manhã:`,
    `📅 Hoje: ${m.booked} marcado${m.booked === 1 ? "" : "s"}${m.firstAt ? `, o primeiro às ${hourLabel(m.firstAt, tz)}` : ""}${m.confirmed ? ` (${m.confirmed} confirmado${m.confirmed === 1 ? "" : "s"})` : ""}.`,
    `⏳ Atrasados: ${m.overdue} passaram da hora de voltar${m.overdue ? `, ${m.called} já chamado${m.called === 1 ? "" : "s"}` : ""}.`,
    `💸 Perdido ontem: ${brl(m.lostValue)}${m.noShows || m.cancels ? ` (${m.noShows} falta${m.noShows === 1 ? "" : "s"}, ${m.cancels} cancelamento${m.cancels === 1 ? "" : "s"} sem reposição)` : ""}.`,
    m.openQuotes ? `📝 Orçamentos esperando resposta: ${m.openQuotes} (${brl(m.openQuotesValue)}).` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function morning({ s, now, force }: Ctx) {
  const tz = s.timezone;
  if (!force && parts(now, tz).h < 7) return 0;
  if (!force && !(await once(`manha:${dayKey(now, tz)}`))) return 0;
  const text = morningText(s, await morningStats(s, now));
  await sendOwner(s.ownerPhone, text, "manha");
  await logActivity("manha", "Página da manhã enviada ao dono");
  return 1;
}

/* ---------- Tudo junto ---------- */

export async function runAgents(s: Settings, opts: { now?: Date; force?: boolean } = {}): Promise<Report> {
  const ctx: Ctx = { s, now: opts.now ?? new Date(), force: Boolean(opts.force) };
  const report: Report = {};
  report.concluidos = await autoComplete(ctx);
  if (agentOn(s, "lembretes")) report.lembretes = await reminders(ctx);
  if (agentOn(s, "avaliacoes")) report.avaliacoes = await reviews(ctx);
  if (agentOn(s, "retornos")) report.retornos = await returns(ctx);
  if (agentOn(s, "orcamentos")) report.orcamentos = await quoteFollowups(ctx);
  if (agentOn(s, "manha")) report.manha = await morning(ctx);
  return report;
}

/**
 * Roda os agentes no máximo uma vez a cada 10 minutos, aproveitando visitas ao painel e mensagens
 * que chegam. Garante que tudo anda mesmo sem o agendador externo (/api/cron).
 */
export async function maybeRunAgents(s: Settings) {
  if (!s.configured) return null;
  const rows = await q(
    `insert into job_runs (tenant_id, key, ran_at) values ($1, 'tick', now())
     on conflict (tenant_id, key) do update set ran_at = now() where job_runs.ran_at < now() - interval '10 minutes'
     returning key`,
    [await tenantId()],
  );
  return rows.length ? runAgents(s) : null;
}
