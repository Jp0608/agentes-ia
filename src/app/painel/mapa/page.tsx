import Link from "next/link";
import { Icon } from "@/components/Icon";
import { PageHead } from "@/components/ui";
import { LIVE_SECTOR, loadMap } from "@/lib/maps";
import { findNiche, GROUPS, NICHES } from "@/lib/niches";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Mapa" };

const COLORS = ["#fb923c", "#a78bfa", "#fb7185", "#f472b6", "#facc15", "#60a5fa", "#2dd4bf", "#a3e635"];

export default async function Page({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const s = await getSettings();
  const id = (await searchParams).n ?? s.niche;
  const niche = findNiche(id);
  const map = await loadMap(niche.id);
  return (
    <>
      <PageHead eyebrow="Mapa de agentes" title={`O mapa ${map?.title ?? `de ${niche.label.toLowerCase()}`}`} />
      <p className="-mt-3 mb-4 max-w-2xl text-[14px] text-soft">
        Todos os agentes que esse tipo de negócio precisa, cada um com o fluxo escrito. Os setores com o selo verde já rodam nesta instalação; os
        outros são o que dá para montar para o cliente depois.
      </p>
      <nav aria-label="Outros nichos" className="mb-6 flex flex-wrap gap-1.5">
        {GROUPS.map((g) => (
          <span key={g.id} className="contents">
            {NICHES.filter((n) => n.group === g.id).map((n) => (
              <Link
                key={n.id}
                href={`/painel/mapa?n=${n.id}`}
                aria-current={n.id === niche.id ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] ${n.id === niche.id ? "border-signal bg-signal font-semibold text-on-signal" : "border-line text-soft hover:text-ink"}`}
              >
                <Icon name={n.icon} size={15} /> {n.label}
              </Link>
            ))}
          </span>
        ))}
      </nav>
      {!map ? (
        <p className="card p-6 text-[14px] text-faint">O mapa deste nicho ainda está sendo escrito.</p>
      ) : (
        <div className="grid gap-x-4 gap-y-8 md:grid-cols-2 2xl:grid-cols-3">
          {map.sectors.map((sec, i) => {
            const c = COLORS[i % COLORS.length];
            const live = LIVE_SECTOR.test(sec.name);
            return (
              <section key={sec.name} className="card p-3" style={{ borderColor: `color-mix(in oklab, ${c} 55%, transparent)`, boxShadow: `0 0 40px -22px ${c}` }}>
                <header className="mb-2 flex items-center gap-2 px-1">
                  <span className="rounded-md px-1.5 font-mono text-[11px] font-bold text-black" style={{ background: c }}>{String(i + 1).padStart(2, "0")}</span>
                  <h2 className="min-w-0 flex-1 truncate font-mono text-[13px] font-semibold uppercase tracking-[0.14em]">{sec.name}</h2>
                  {live ? <span className="tag border-signal/40 bg-signal/10 text-signal">já funciona</span> : <span className="tag border-line text-faint">próximo passo</span>}
                </header>
                <p className="mb-3 px-1 text-[13px] text-soft">{sec.line}</p>
                <div className="space-y-2">
                  {sec.agents.map((a) => (
                    <details key={a.name} className="box group px-3 py-2">
                      <summary className="flex cursor-pointer list-none items-center gap-2 text-[13.5px] font-semibold">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} /> <span className="flex-1">{a.name}</span>
                        <Icon name="expand_more" size={18} className="text-faint transition group-open:rotate-180" />
                      </summary>
                      <p className="mt-2 text-[12.5px] text-soft"><b className="text-ink">Quando:</b> {a.when}</p>
                      <ol className="mt-2 space-y-1">
                        {a.flow.map((f, j) => (
                          <li key={j} className="grid grid-cols-[18px_1fr] gap-2 text-[12.5px] leading-snug">
                            <span className="grid h-4 place-items-center rounded font-mono text-[10px] font-bold text-black" style={{ background: c }}>{j + 1}</span>
                            {f}
                          </li>
                        ))}
                      </ol>
                      <p className="mt-2 text-[12px] text-warn">{a.human}</p>
                    </details>
                  ))}
                </div>
              </section>
            );
          })}
          <section className="card border-signal/40 p-4">
            <p className="eyebrow">Página da manhã</p>
            <p className="mt-1 text-[13px] text-soft">{map.morning.when}</p>
            <div className="mt-3 space-y-2">
              {map.morning.stats.map((st) => (
                <div key={st.label} className="box flex items-center gap-3 px-3 py-2">
                  <b className="num text-[20px] text-signal">{st.value}</b>
                  <span className="text-[12.5px] leading-tight"><b className="block text-ink">{st.label}</b><span className="text-faint">{st.sub}</span></span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
