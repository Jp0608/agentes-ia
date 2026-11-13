import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { q } from "./db";
import {
  book,
  BookingError,
  findService,
  freeSlots,
  historyOf,
  nextFreeSlots,
  setStatus,
  upcomingOf,
  type Client,
} from "./booking";
import { findNiche } from "./niches";
import { offerFreedSlot } from "./jobs";
import type { Settings } from "./settings";
import { addDays, brl, dayKey, hourLabel, parts, shortDate, shortName, WEEKDAYS, whenLabel, zoned } from "./time";
import { logActivity, send, sendOwner } from "./whatsapp";

/**
 * Recepção: o Claude conversa com o cliente e usa a agenda por ferramentas. O fluxo escrito da
 * recepção (editável no painel) entra como instrução; as regras de segurança ficam fixas aqui.
 */
const MODEL = () => process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5-5";

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

const obj = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object" as const,
  properties,
  required,
  additionalProperties: false,
});

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "ver_horarios",
    description:
      "Lista horários livres para um serviço. Passe o dia (AAAA-MM-DD) quando a pessoa disser um dia; sem dia, devolve as próximas opções.",
    input_schema: obj({ servico: { type: "string" }, dia: { type: "string", description: "AAAA-MM-DD, ou vazio para as próximas opções" } }, ["servico", "dia"]),
    strict: true,
  },
  {
    name: "marcar",
    description: "Marca um horário que a pessoa escolheu. Use só depois que ela escolher. inicio no formato AAAA-MM-DDTHH:MM, horário local.",
    input_schema: obj({ servico: { type: "string" }, inicio: { type: "string" } }, ["servico", "inicio"]),
    strict: true,
  },
  {
    name: "remarcar",
    description: "Muda um horário já marcado da pessoa para outro início (AAAA-MM-DDTHH:MM).",
    input_schema: obj({ agendamento_id: { type: "integer" }, novo_inicio: { type: "string" } }, ["agendamento_id", "novo_inicio"]),
    strict: true,
  },
  {
    name: "cancelar",
    description: "Cancela um horário marcado da pessoa.",
    input_schema: obj({ agendamento_id: { type: "integer" } }, ["agendamento_id"]),
    strict: true,
  },
  {
    name: "lista_de_espera",
    description: "Coloca a pessoa na lista de espera quando não há horário que sirva. preferencia: o dia ou período que ela quer.",
    input_schema: obj({ servico: { type: "string" }, preferencia: { type: "string" } }, ["servico", "preferencia"]),
    strict: true,
  },
  {
    name: "salvar_nome",
    description: "Guarda o nome da pessoa quando ela disser.",
    input_schema: obj({ nome: { type: "string" } }, ["nome"]),
    strict: true,
  },
  {
    name: "responder_orcamento",
    description: "Registra a resposta da pessoa a um orçamento enviado: aceitou ou recusou, com o que ela disse.",
    input_schema: obj({ orcamento_id: { type: "integer" }, aceitou: { type: "boolean" }, comentario: { type: "string" } }, [
      "orcamento_id",
      "aceitou",
      "comentario",
    ]),
    strict: true,
  },
  {
    name: "avaliar",
    description: "Registra a nota (1 a 5) que a pessoa deu ao último atendimento, com o que ela escreveu.",
    input_schema: obj({ nota: { type: "integer" }, comentario: { type: "string" } }, ["nota", "comentario"]),
    strict: true,
  },
  {
    name: "chamar_dono",
    description: "Avisa o dono no WhatsApp dele. Use para reclamação, urgência, pedido de desconto ou pergunta que as informações do negócio não respondem.",
    input_schema: obj({ motivo: { type: "string" } }, ["motivo"]),
    strict: true,
  },
  {
    name: "parar_mensagens",
    description: "A pessoa pediu para não receber mais mensagens automáticas (retornos, lembretes de voltar).",
    input_schema: obj({}, []),
    strict: true,
  },
];

function businessBlock(s: Settings) {
  const n = findNiche(s.niche);
  const hours = s.hours
    .map((h, i) => `${WEEKDAYS[i]}: ${h ? `${h.open.replace(":", "h")} às ${h.close.replace(":", "h")}` : "fechado"}`)
    .join("; ");
  const services = s.services.map((x) => `- ${x.name}: ${x.minutes} min, ${x.price > 0 ? brl(x.price) : "sem custo / valor sob consulta"}`).join("\n");
  return [
    `Você é a recepção de ${s.businessName || n.label} (${n.label.toLowerCase()}) no WhatsApp.`,
    `Quem atende é chamado de ${n.staff}; quem é atendido, de ${n.client}. Cada atendimento é um(a) ${n.visit}.`,
    s.address ? `Endereço: ${s.address}` : "",
    `Funcionamento: ${hours}.`,
    `Serviços:\n${services}`,
    s.about ? `Informações do negócio (use só o que está aqui, não invente):\n${s.about}` : "",
    `Cancelamento pelo WhatsApp: até ${s.cancelHours} horas antes.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const RULES = `Regras:
- Escreva como uma pessoa da recepção no WhatsApp: mensagens curtas, simples, em português do Brasil, no máximo um emoji.
- Nunca invente horário, preço, endereço ou informação. Horário só existe se a ferramenta ver_horarios mostrou.
- Ofereça no máximo três horários por vez e só marque depois que a pessoa escolher.
- Depois de marcar, confirme o dia, a hora e o serviço numa frase.
- Não dê diagnóstico, orientação de saúde, jurídica ou financeira: diga que o profissional responde e use chamar_dono.
- Se a pessoa responder a uma mensagem de retorno, lista de espera ou orçamento, continue daquele assunto.
- Se a mensagem for só um agradecimento ou um "ok", responda curto e não puxe outro assunto.
- Se não precisar responder nada (por exemplo, a pessoa só mandou um emoji depois de tudo resolvido), responda exatamente: [sem resposta]`;

function systemPrompt(s: Settings) {
  return `${businessBlock(s)}\n\nFluxo escrito da recepção (siga nesta ordem):\n${s.agents.recepcao.flow}\n\n${RULES}`;
}

async function contextBlock(s: Settings, c: Client, now: Date) {
  const tz = s.timezone;
  const p = parts(now, tz);
  const upcoming = await upcomingOf(c.id, now);
  const past = (await historyOf(c.id, 3)).filter((a) => a.starts_at < now);
  const quotes = await q<{ id: number; title: string; total: string; status: string }>(
    "select id, title, total, status from quotes where client_id = $1 and status = 'enviado' order by id desc limit 3",
    [c.id],
  );
  const lines = [
    `Agora: ${WEEKDAYS[p.wd]}, ${dayKey(now, tz)}, ${hourLabel(now, tz)}. Amanhã é ${addDays(dayKey(now, tz), 1)}.`,
    `Pessoa: ${c.name || "nome ainda não informado"} (WhatsApp ${c.phone}).`,
    upcoming.length
      ? `Horários marcados: ${upcoming.map((a) => `#${a.id} ${a.service} ${whenLabel(a.starts_at, tz, now)} (${a.status})`).join("; ")}.`
      : "Sem horário marcado.",
    past.length ? `Últimos atendimentos: ${past.map((a) => `${a.service} em ${dayKey(a.starts_at, tz)} (${a.status})`).join("; ")}.` : "",
    quotes.length ? `Orçamentos esperando resposta: ${quotes.map((x) => `#${x.id} ${x.title} (${brl(Number(x.total))})`).join("; ")}.` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

/** Converte "2026-11-20T09:30" (local) em instante. */
function parseLocal(s: Settings, value: string) {
  const m = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})/);
  if (!m) return null;
  return zoned(m[1], `${m[2].padStart(2, "0")}:${m[3]}`, s.timezone);
}

type ToolCtx = { s: Settings; c: Client; now: Date };

async function runTool(name: string, input: Record<string, unknown>, ctx: ToolCtx): Promise<string> {
  const { s, c, now } = ctx;
  const tz = s.timezone;
  const fmt = (d: Date) => `${dayKey(d, tz)}T${String(parts(d, tz).h).padStart(2, "0")}:${String(parts(d, tz).min).padStart(2, "0")} (${whenLabel(d, tz, now)})`;
  switch (name) {
    case "ver_horarios": {
      const service = findService(s, String(input.servico ?? ""));
      if (!service) return `Serviço não encontrado. Serviços: ${s.services.map((x) => x.name).join(", ")}.`;
      const day = typeof input.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.dia) ? input.dia : null;
      if (day) {
        const slots = await freeSlots(s, service.name, day, { now });
        if (!slots.length) {
          const next = await nextFreeSlots(s, service.name, { fromDay: addDays(day, 1), now });
          return `Nenhum horário livre para ${service.name} em ${day}. Próximas opções: ${next.map((x) => fmt(x.start)).join("; ") || "nenhuma nos próximos 14 dias"}.`;
        }
        return `Livres para ${service.name} em ${day}: ${slots.map((x) => hourLabel(x.start, tz)).join(", ")}. Formato para marcar: ${day}THH:MM.`;
      }
      const next = await nextFreeSlots(s, service.name, { now, limit: 4 });
      return next.length ? `Próximos horários para ${service.name}: ${next.map((x) => fmt(x.start)).join("; ")}.` : "Nenhum horário livre nos próximos 14 dias.";
    }
    case "marcar": {
      const start = parseLocal(s, String(input.inicio ?? ""));
      if (!start) return "Formato de início inválido. Use AAAA-MM-DDTHH:MM.";
      if (start.getTime() < now.getTime()) return "Esse horário já passou.";
      try {
        const a = await book(s, { clientId: c.id, service: String(input.servico), start, source: "whatsapp" });
        await logActivity("recepcao", `Marcou ${a.service} para ${c.name || c.phone} ${whenLabel(a.starts_at, tz, now)}`, c.phone);
        await q("update waitlist set status = 'atendido' where client_id = $1 and status <> 'atendido'", [c.id]);
        return `Marcado: #${a.id} ${a.service} ${whenLabel(a.starts_at, tz, now)}, ${a.resource}.`;
      } catch (e) {
        if (e instanceof BookingError) return `Não deu para marcar: ${e.message} Ofereça outro horário.`;
        throw e;
      }
    }
    case "remarcar": {
      const id = Number(input.agendamento_id);
      const mine = (await upcomingOf(c.id, now)).find((a) => a.id === id);
      if (!mine) return "Esse agendamento não é desta pessoa ou já passou.";
      const start = parseLocal(s, String(input.novo_inicio ?? ""));
      if (!start) return "Formato de início inválido. Use AAAA-MM-DDTHH:MM.";
      try {
        const old = mine.starts_at;
        const a = await book(s, { clientId: c.id, service: mine.service, start, source: "whatsapp", exceptId: id });
        await logActivity("recepcao", `Remarcou ${a.service} de ${c.name || c.phone} para ${whenLabel(a.starts_at, tz, now)}`, c.phone);
        await offerFreedSlot(s, { service: mine.service, starts_at: old, resource: mine.resource }, now);
        return `Remarcado: #${a.id} ${a.service} ${whenLabel(a.starts_at, tz, now)}.`;
      } catch (e) {
        if (e instanceof BookingError) return `Não deu para remarcar: ${e.message}`;
        throw e;
      }
    }
    case "cancelar": {
      const id = Number(input.agendamento_id);
      const mine = (await upcomingOf(c.id, now)).find((a) => a.id === id);
      if (!mine) return "Esse agendamento não é desta pessoa ou já passou.";
      if (mine.starts_at.getTime() - now.getTime() < s.cancelHours * 3600_000) {
        return `Faltam menos de ${s.cancelHours} horas: não cancele. Diga que vai avisar o dono e use chamar_dono.`;
      }
      await setStatus(id, "cancelado");
      await logActivity("recepcao", `Cancelou ${mine.service} de ${c.name || c.phone} (${whenLabel(mine.starts_at, tz, now)})`, c.phone);
      await offerFreedSlot(s, mine, now);
      return "Cancelado. Ofereça remarcar.";
    }
    case "lista_de_espera": {
      const service = findService(s, String(input.servico ?? ""));
      await q("insert into waitlist (client_id, service, wants) values ($1, $2, $3)", [c.id, service?.name ?? String(input.servico), String(input.preferencia ?? "")]);
      await logActivity("espera", `${c.name || c.phone} entrou na lista de espera (${service?.name ?? input.servico}, ${input.preferencia})`, c.phone);
      return "Na lista de espera. Diga que avisa assim que abrir uma vaga.";
    }
    case "salvar_nome": {
      const nome = String(input.nome ?? "").trim().slice(0, 80);
      if (nome) await q("update clients set name = $2 where id = $1", [c.id, nome]);
      c.name = nome || c.name;
      return "Nome salvo.";
    }
    case "responder_orcamento": {
      const id = Number(input.orcamento_id);
      const accepted = Boolean(input.aceitou);
      const rows = await q<{ title: string }>(
        "update quotes set status = $3, answered_at = now() where id = $1 and client_id = $2 returning title",
        [id, c.id, accepted ? "aceito" : "recusado"],
      );
      if (!rows.length) return "Orçamento não encontrado para esta pessoa.";
      await logActivity("orcamentos", `${c.name || c.phone} ${accepted ? "aceitou" : "recusou"} o orçamento "${rows[0].title}"`, c.phone);
      await sendOwner(
        s.ownerPhone,
        `${accepted ? "✅" : "❌"} ${c.name || c.phone} ${accepted ? "aceitou" : "recusou"} o orçamento "${rows[0].title}". ${String(input.comentario ?? "")}`.trim(),
        "orcamentos",
      );
      return accepted ? "Registrado. Ofereça marcar a primeira sessão." : "Registrado.";
    }
    case "avaliar": {
      const nota = Math.max(1, Math.min(5, Number(input.nota) || 0));
      return registerReview(s, c, nota, String(input.comentario ?? ""), now);
    }
    case "chamar_dono": {
      const motivo = String(input.motivo ?? "").slice(0, 400);
      await sendOwner(s.ownerPhone, `🔔 ${c.name || "Cliente"} (${c.phone}) precisa de você: ${motivo}`, "recepcao");
      await logActivity("recepcao", `Chamou o dono: ${motivo}`, c.phone);
      return "Dono avisado. Diga à pessoa que ele vai responder.";
    }
    case "parar_mensagens": {
      await q("update clients set opt_out = true where id = $1", [c.id]);
      await logActivity("retornos", `${c.name || c.phone} pediu para não receber mais mensagens`, c.phone);
      return "Feito. Confirme que ela não vai mais receber mensagens automáticas.";
    }
  }
  return "Ferramenta desconhecida.";
}

/** Nota do último atendimento: boa vai para o Google, ruim vai primeiro para o dono. */
export async function registerReview(s: Settings, c: Client, nota: number, comentario: string, now = new Date()) {
  const rows = await q<{ id: number; service: string }>(
    `update appointments set review_score = $2, review_text = $3
     where id = (select id from appointments where client_id = $1 and status = 'concluido' order by starts_at desc limit 1)
     returning id, service`,
    [c.id, nota, comentario.slice(0, 500)],
  );
  const service = rows[0]?.service ?? "atendimento";
  if (nota >= 4) {
    await logActivity("avaliacoes", `${c.name || c.phone} deu nota ${nota} para ${service}`, c.phone);
    return s.googleReviewUrl
      ? `Nota boa. Agradeça e mande este link pedindo uma avaliação no Google: ${s.googleReviewUrl}`
      : "Nota boa. Agradeça (não há link do Google configurado).";
  }
  await logActivity("avaliacoes", `Nota ${nota} de ${c.name || c.phone} (${service}): alerta enviado ao dono`, c.phone);
  await sendOwner(
    s.ownerPhone,
    `⚠️ Avaliação baixa: ${c.name || c.phone} deu nota ${nota} para ${service} (${shortDate(now, s.timezone)}).${comentario ? `\n"${comentario}"` : ""}\nWhatsApp: ${c.phone}`,
    "avaliacoes",
  );
  return "Nota baixa. Peça desculpas, sem justificar, diga que o dono vai entrar em contato pessoalmente. Não mande link.";
}

type Msg = { direction: "in" | "out"; body: string };

function toMessages(history: Msg[]): Anthropic.Beta.BetaMessageParam[] {
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of history) {
    const role = m.direction === "in" ? "user" : "assistant";
    const last = out[out.length - 1];
    if (last && last.role === role && typeof last.content === "string") last.content = `${last.content}\n${m.body}`;
    else out.push({ role, content: m.body });
  }
  if (out[0]?.role === "assistant") out.unshift({ role: "user", content: "(a conversa começou com uma mensagem do negócio)" });
  if (out[out.length - 1]?.role !== "user") out.push({ role: "user", content: "(sem mensagem nova)" });
  return out;
}

export const aiReady = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim());

/** Responde a conversa do cliente. Devolve o texto enviado (ou null quando não precisa responder). */
export async function reply(s: Settings, c: Client, opts: { now?: Date } = {}): Promise<string | null> {
  const now = opts.now ?? new Date();
  const history = (
    await q<Msg>(
      `select direction, body from (
         select direction, body, created_at from messages where phone = $1 and created_at > $2 order by created_at desc limit 30
       ) t order by created_at`,
      [c.phone, new Date(now.getTime() - 48 * 3600_000)],
    )
  ).map((m) => ({ direction: m.direction, body: m.body }));

  if (!aiReady()) {
    const text = `Oi${c.name ? `, ${shortName(c.name)}` : ""}! Recebi sua mensagem e já vou te responder.`;
    await send(c.phone, text, "recepcao", { simulated: c.simulated });
    await sendOwner(s.ownerPhone, `💬 ${c.name || c.phone}: ${history.at(-1)?.body ?? ""}\n(a IA está sem chave: configure ANTHROPIC_API_KEY)`, "recepcao");
    return text;
  }

  const messages = toMessages(history);
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: systemPrompt(s), cache_control: { type: "ephemeral" } },
    { type: "text", text: await contextBlock(s, c, now) },
  ];

  for (let i = 0; i < 8; i++) {
    const res = await anthropic().beta.messages.create({
      model: MODEL(),
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system,
      tools: TOOLS,
      messages,
    });
    if (res.stop_reason === "refusal") break;
    messages.push({ role: "assistant", content: res.content });
    const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (res.stop_reason === "tool_use" && uses.length) {
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const u of uses) {
        try {
          const out = await runTool(u.name, (u.input ?? {}) as Record<string, unknown>, { s, c, now });
          results.push({ type: "tool_result", tool_use_id: u.id, content: out });
        } catch (e) {
          results.push({ type: "tool_result", tool_use_id: u.id, content: `Erro: ${(e as Error).message}`, is_error: true });
        }
      }
      messages.push({ role: "user", content: results });
      continue;
    }
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text || text.includes("[sem resposta]")) return null;
    await send(c.phone, text, "recepcao", { simulated: c.simulated });
    return text;
  }
  const fallback = "Desculpa, me enrolei aqui. Já te respondo!";
  await send(c.phone, fallback, "recepcao", { simulated: c.simulated });
  await sendOwner(s.ownerPhone, `🔔 A recepção não conseguiu responder ${c.name || c.phone}. Dá uma olhada na conversa.`, "recepcao");
  return fallback;
}

/** Texto em palavras simples para um orçamento (agente de orçamentos). */
export async function explainQuote(s: Settings, title: string, items: { name: string; price: number }[]) {
  if (!aiReady()) return "";
  const n = findNiche(s.niche);
  const res = await anthropic().beta.messages.create({
    model: MODEL(),
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: `Você escreve para ${s.businessName || n.label} (${n.label.toLowerCase()}). Explique um orçamento em palavras simples para o ${n.client}, em 2 ou 3 frases curtas, em português do Brasil, sem termos técnicos, sem repetir os valores e sem prometer resultado. Responda só com o texto.`,
    messages: [{ role: "user", content: `Orçamento: ${title}\nItens: ${items.map((i) => i.name).join("; ")}` }],
  });
  if (res.stop_reason === "refusal") return "";
  return res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .trim();
}

export { hourLabel };
