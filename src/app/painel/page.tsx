import Link from "next/link";
import { redirect } from "next/navigation";
import { ApptButtons } from "@/components/ApptButtons";
import { Icon } from "@/components/Icon";
import { RunAgents } from "@/components/RunAgents";
import { PageHead, StatusTag } from "@/components/ui";
import { AGENTS } from "@/lib/agents";
import { appointmentsBetween } from "@/lib/booking";
import { q } from "@/lib/db";
import { morningStats } from "@/lib/jobs";
import { getSettings } from "@/lib/settings";
import { addDays, brl, dayKey, hourLabel, parts, shortName, WEEKDAYS, zoned } from "@/lib/time";

export const metadata = { title: "Hoje" };

type Act = { id: number; agent: string; summary: string; phone: string | null; created_at: Date };

export default async function Page() {
  const s = await getSettings();
  if (!s.configured) redirect("/painel/configurar");
  const now = new Date();
  const tz = s.timezone;
  const today = dayKey(now, tz);
  const [m, appts, acts] = await Promise.all([
    morningStats(s, now),
    appointmentsBetween(zoned(today, "00:00", tz), zoned(addDays(today, 1), "00:00", tz)),
    q<Act>("select * from activity order by created_at desc limit 25"),
  ]);
  const p = parts(now, tz);
  const stats = [
    { value: String(m.booked), label: "Marcados hoje", sub: m.firstAt ? `o primeiro às ${hourLabel(m.firstAt, tz)}` : "agenda livre", color: "var(--color-signal)" },
    { value: String(m.overdue), label: "Atrasados", sub: m.overdue ? `passaram da hora de voltar, ${m.called} já chamados` : "ninguém atrasado", color: "var(--color-warn)" },
    { value: brl(m.lostValue), label: "Perdido ontem", sub: `${m.noShows} falta${m.noShows === 1 ? "" : "s"}, ${m.cancels} cancelamento${m.cancels === 1 ? "" : "s"} sem reposição`, color: "var(--color-alert)" },
    { value: String(m.openQuotes), label: "Orçamentos esperando", sub: m.openQuotes ? brl(m.openQuotesValue) : "nenhum", color: "var(--color-info)" },
  ];
  const agentOf = (k: string) => AGENTS.find((a) => a.key === k);
  return (
    <>
      <PageHead eyebrow="Página da manhã" title={`Bom dia${s.ownerName ? `, ${shortName(s.ownerName)}` : ""}`}>
        <span className="self-center text-[13px] text-faint">{WEEKDAYS[p.wd]}, {today.split("-").reverse().join("/")}</span>
      </PageHead>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((st) => (
          <div key={st.label} className="card p-4" style={{ borderColor: `color-mix(in oklab, ${st.color} 35%, transparent)` }}>
            <p className="num text-[30px] font-bold leading-none" style={{ color: st.color }}>{st.value}</p>
            <p className="mt-2 text-[14px] font-semibold">{st.label}</p>
            <p className="text-[12.5px] text-faint">{st.sub}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[16px] font-semibold">Agentes</h2>
          <span className="text-[12.5px] text-faint">Rodam sozinhos a cada 10 minutos. Use os botões para ver na hora.</span>
        </div>
        <RunAgents demo />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold">Agenda de hoje</h2>
            <Link href="/painel/agenda" className="btn-quiet min-h-8 text-[13px]">Ver agenda <Icon name="arrow_forward" size={16} /></Link>
          </div>
          {appts.length === 0 ? (
            <p className="py-6 text-center text-[14px] text-faint">Nada marcado para hoje.</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {appts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="num w-14 font-mono text-[14px] font-semibold">{hourLabel(a.starts_at, tz)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{a.client_name || a.client_phone}</span>
                    <span className="block truncate text-[12.5px] text-faint">{a.service} · {a.resource}</span>
                  </span>
                  <StatusTag status={a.status} />
                  <ApptButtons id={a.id} status={a.status} past={a.starts_at < now} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4">
          <h2 className="mb-3 text-[16px] font-semibold">O que os agentes fizeram</h2>
          {acts.length === 0 ? (
            <p className="py-6 text-center text-[14px] text-faint">Ainda nada. Abra o simulador ou rode os agentes.</p>
          ) : (
            <ul className="space-y-2.5">
              {acts.map((a) => {
                const def = agentOf(a.agent);
                return (
                  <li key={a.id} className="flex gap-2.5">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in oklab, ${def?.color ?? "#6f7a75"} 16%, transparent)`, color: def?.color ?? "#a9b3ae" }}>
                      <Icon name={def?.icon ?? "settings"} size={16} />
                    </span>
                    <span className="min-w-0 flex-1 text-[13.5px] leading-snug">
                      {a.summary}
                      <span className="block text-[11.5px] text-faint">{def?.name ?? "Sistema"} · {hourLabel(new Date(a.created_at), tz)} {dayKey(new Date(a.created_at), tz) !== today && `(${dayKey(new Date(a.created_at), tz).split("-").reverse().slice(0, 2).join("/")})`}</span>
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
