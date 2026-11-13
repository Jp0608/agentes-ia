import Link from "next/link";
import { redirect } from "next/navigation";
import { ApptButtons } from "@/components/ApptButtons";
import { Icon } from "@/components/Icon";
import { PageHead, StatusTag } from "@/components/ui";
import { AGENTS } from "@/lib/agents";
import { appointmentsBetween } from "@/lib/booking";
import { q } from "@/lib/db";
import { morningStats } from "@/lib/jobs";
import { getSettings } from "@/lib/settings";
import { tenantId } from "@/lib/tenant";
import { addDays, brl, dayKey, dayLabel, hourLabel, parts, shortName, WEEKDAYS, whenLabel, zoned } from "@/lib/time";

export const metadata = { title: "Painel" };

type Act = { id: number; agent: string; summary: string; phone: string | null; created_at: Date };

export default async function Page() {
  const s = await getSettings();
  if (!s.configured) redirect("/painel/configurar");
  const now = new Date();
  const tz = s.timezone;
  const today = dayKey(now, tz);
  const [m, appts, week, acts] = await Promise.all([
    morningStats(s, now),
    appointmentsBetween(zoned(today, "00:00", tz), zoned(addDays(today, 1), "00:00", tz)),
    appointmentsBetween(zoned(addDays(today, 1), "00:00", tz), zoned(addDays(today, 8), "00:00", tz)),
    q<Act>("select * from activity where tenant_id = $1 order by created_at desc limit 25", [await tenantId()]),
  ]);
  const p = parts(now, tz);
  const greeting = p.h < 12 ? "Bom dia" : p.h < 18 ? "Boa tarde" : "Boa noite";
  const live = (a: { status: string }) => a.status !== "cancelado" && a.status !== "faltou";
  const todayLive = appts.filter(live);
  const upcoming = week.filter(live);
  const expected = todayLive.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
  const weekValue = upcoming.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
  const next = todayLive.find((a) => a.starts_at >= now) ?? upcoming[0];
  const byDay = new Map<string, typeof upcoming>();
  for (const a of upcoming) {
    const k = dayKey(a.starts_at, tz);
    byDay.set(k, [...(byDay.get(k) ?? []), a]);
  }
  const stats = [
    { value: String(todayLive.length), label: "Agendamentos hoje", sub: todayLive.length ? `${brl(expected)} previsto` : "agenda livre", color: "var(--color-signal)" },
    { value: String(upcoming.length), label: "Próximos 7 dias", sub: upcoming.length ? `${brl(weekValue)} previsto` : "nada marcado ainda", color: "var(--color-info)" },
  ];
  const agentOf = (k: string) => AGENTS.find((a) => a.key === k);
  return (
    <>
      <PageHead title={`${greeting}${s.ownerName ? `, ${shortName(s.ownerName)}` : ""}`}>
        <span className="self-center text-[15px] capitalize text-soft">{WEEKDAYS[p.wd]}, {today.split("-").reverse().join("/")}</span>
      </PageHead>

      <section className="grid grid-cols-2 gap-3">
        {stats.map((st) => (
          <div key={st.label} className="card p-4" style={{ borderColor: `color-mix(in oklab, ${st.color} 35%, transparent)` }}>
            <p className="num text-[40px] font-bold leading-none sm:text-[44px]" style={{ color: st.color }}>{st.value}</p>
            <p className="mt-2 text-[16px] font-semibold leading-snug sm:text-[17px]">{st.label}</p>
            <p className="mt-0.5 text-[14px] text-soft sm:text-[15px]">{st.sub}</p>
          </div>
        ))}
      </section>

      {next && (
        <section className="mt-3 card flex flex-wrap items-center gap-3 p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-signal/15 text-signal"><Icon name="schedule" size={24} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold uppercase tracking-wider text-faint">Próximo atendimento</span>
            <span className="block text-[17px] font-semibold leading-snug">{next.client_name || next.client_phone} · {next.service}</span>
          </span>
          <span className="num w-full text-[17px] font-semibold text-signal sm:w-auto">{whenLabel(next.starts_at, tz, now)}</span>
        </section>
      )}

      <section className="mt-6 card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[19px] font-semibold">Próximos agendamentos</h2>
          <Link href="/painel/agenda" className="btn-quiet -mr-2 min-h-11 shrink-0 text-[15px] text-signal">Agenda <Icon name="arrow_forward" size={18} /></Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="py-6 text-center text-[15px] text-soft">Nenhum agendamento nos próximos 7 dias. Quando um cliente marcar pelo WhatsApp, aparece aqui.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...byDay.entries()].map(([k, list]) => (
              <div key={k} className="box p-3">
                <p className="mb-2 flex items-center justify-between text-[15px] font-semibold capitalize">
                  {dayLabel(list[0].starts_at, tz, now)}
                  <span className="tag border-line text-soft">{list.length}</span>
                </p>
                <ul className="space-y-2">
                  {list.map((a) => (
                    <li key={a.id} className="flex items-center gap-2.5 text-[15px]">
                      <span className="num w-14 shrink-0 font-mono font-semibold text-signal">{hourLabel(a.starts_at, tz)}</span>
                      <span className="min-w-0 flex-1 truncate">{a.client_name || a.client_phone} <span className="text-faint">· {a.service}</span></span>
                      <StatusTag status={a.status} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 card flex flex-wrap items-center gap-3 p-4">
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-signal/15 text-signal"><Icon name="smart_toy" size={24} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold">Atendimento ligado 24 horas</span>
          <span className="block text-[15px] leading-snug text-soft">A assistente responde o WhatsApp, marca os horários e manda os lembretes sozinha. Você não precisa fazer nada.</span>
        </span>
        <span className="tag border-signal/40 text-signal"><span className="h-1.5 w-1.5 rounded-full bg-signal" /> Ligado</span>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-[19px] font-semibold">Agenda de hoje</h2>
            <Link href="/painel/agenda" className="btn-quiet -mr-2 min-h-11 shrink-0 text-[15px] text-signal">Ver tudo <Icon name="arrow_forward" size={18} /></Link>
          </div>
          {appts.length === 0 ? (
            <p className="py-6 text-center text-[15px] text-soft">Nada marcado para hoje.</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {appts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                  <span className="num w-14 shrink-0 font-mono text-[16px] font-semibold text-signal">{hourLabel(a.starts_at, tz)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold">{a.client_name || a.client_phone}</span>
                    <span className="block text-[14px] text-soft">{a.service} · {a.resource}</span>
                  </span>
                  <StatusTag status={a.status} />
                  <ApptButtons id={a.id} status={a.status} past={a.starts_at < now} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4">
          <h2 className="mb-3 text-[19px] font-semibold">Últimas atividades</h2>
          {acts.length === 0 ? (
            <p className="py-6 text-center text-[15px] text-soft">Ainda nada por aqui. Quando um cliente chamar no WhatsApp, aparece nesta lista.</p>
          ) : (
            <ul className="space-y-3">
              {acts.map((a) => {
                const def = agentOf(a.agent);
                return (
                  <li key={a.id} className="flex gap-2.5">
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in oklab, ${def?.color ?? "#6f7a75"} 16%, transparent)`, color: def?.color ?? "#a9b3ae" }}>
                      <Icon name={def?.icon ?? "settings"} size={18} />
                    </span>
                    <span className="min-w-0 flex-1 break-words text-[15px] leading-snug">
                      {a.summary}
                      <span className="mt-0.5 block text-[13px] text-faint">{def?.name ?? "Sistema"} · {hourLabel(new Date(a.created_at), tz)} {dayKey(new Date(a.created_at), tz) !== today && `(${dayKey(new Date(a.created_at), tz).split("-").reverse().slice(0, 2).join("/")})`}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
