import Link from "next/link";
import { Icon } from "@/components/Icon";
import { PageHead } from "@/components/ui";
import { AGENTS } from "@/lib/agents";
import { q } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { tenantId } from "@/lib/tenant";
import { dayKey, hourLabel } from "@/lib/time";

export const metadata = { title: "Conversas" };

type Thread = { phone: string; name: string | null; simulated: boolean | null; last: Date; body: string; n: string };
type Msg = { id: number; direction: string; body: string; agent: string | null; created_at: Date };

export default async function Page({ searchParams }: { searchParams: Promise<{ tel?: string }> }) {
  const { tel } = await searchParams;
  const s = await getSettings();
  const tz = s.timezone;
  const t = await tenantId();
  const threads = await q<Thread>(
    `select m.phone, c.name, c.simulated, max(m.created_at) as last, count(*) as n,
       (select body from messages x where x.tenant_id = m.tenant_id and x.phone = m.phone order by created_at desc, id desc limit 1) as body
     from messages m left join clients c on c.tenant_id = m.tenant_id and c.phone = m.phone
     where m.tenant_id = $1
     group by m.tenant_id, m.phone, c.name, c.simulated order by last desc limit 80`,
    [t],
  );
  const open = tel ?? threads[0]?.phone;
  const msgs = open
    ? await q<Msg>("select id, direction, body, agent, created_at from messages where tenant_id = $2 and phone = $1 order by created_at, id limit 400", [open, t])
    : [];
  const cur = threads.find((t) => t.phone === open);
  // Celular: sem ?tel mostra só a lista; com ?tel mostra só a conversa (com botão de voltar).
  // Computador: as duas colunas lado a lado, como antes.
  const picked = Boolean(tel);
  return (
    <>
      <div className={picked ? "hidden lg:block" : ""}>
        <PageHead eyebrow="WhatsApp" title="Conversas" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <ul className={`card p-2 lg:block lg:max-h-[75dvh] lg:overflow-y-auto ${picked ? "hidden" : ""}`}>
          {threads.length === 0 && <li className="p-4 text-[15px] text-faint">Nenhuma conversa ainda.</li>}
          {threads.map((t) => (
            <li key={t.phone}>
              <Link href={`/painel/conversas?tel=${t.phone}`} className={`block rounded-xl px-3 py-3 ${t.phone === open ? "lg:bg-raise-2" : ""} hover:bg-raise active:bg-raise`}>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[16px] font-semibold">{t.phone === "dono" ? "Dono (sem número)" : t.name || t.phone}</span>
                  <span className="shrink-0 text-[13px] text-faint">{hourLabel(new Date(t.last), tz)}</span>
                </span>
                <span className="mt-0.5 block truncate text-[14px] text-soft">{t.simulated ? "[simulado] " : ""}{t.body}</span>
              </Link>
            </li>
          ))}
        </ul>
        <section className={`card chat-h min-w-0 flex-col lg:flex lg:h-[75dvh] ${picked ? "flex" : "hidden"}`}>
          <header className="flex items-center gap-2 border-b border-line px-2 py-2 lg:px-4 lg:py-3">
            <Link href="/painel/conversas" aria-label="Voltar para a lista" className="btn-quiet min-h-11 shrink-0 px-2 lg:hidden"><Icon name="arrow_back" size={24} /></Link>
            <span className="min-w-0">
              <span className="block truncate text-[17px] font-semibold">{cur ? cur.name || cur.phone : "—"}</span>
              {cur && <span className="block truncate font-mono text-[13px] font-normal text-faint">{cur.phone}</span>}
            </span>
          </header>
          {/* column-reverse: a rolagem começa na mensagem mais recente. */}
          <div className="flex flex-1 flex-col-reverse overflow-y-auto px-3 py-4 lg:px-4">
            <div className="space-y-2">
              {msgs.map((m) => {
                const out = m.direction === "out";
                const ag = AGENTS.find((a) => a.key === m.agent);
                return (
                  <div key={m.id} className={`flex ${out ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[15px] leading-snug lg:max-w-[80%] ${out ? "bg-raise-2" : "bg-signal/20"}`}>
                      {out && ag && <span className="mb-0.5 block text-[12px] font-semibold" style={{ color: ag.color }}>{ag.name}</span>}
                      <span className="whitespace-pre-wrap break-words">{m.body}</span>
                      <span className="mt-0.5 block text-right text-[12px] text-faint">{dayKey(new Date(m.created_at), tz).split("-").reverse().slice(0, 2).join("/")} {hourLabel(new Date(m.created_at), tz)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
