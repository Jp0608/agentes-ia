import { PageHead } from "@/components/ui";
import { RunAgents } from "@/components/RunAgents";
import { AGENTS } from "@/lib/agents";
import { getSettings } from "@/lib/settings";
import { AgentCard } from "./AgentCard";

export const metadata = { title: "Agentes" };

export default async function Page() {
  const s = await getSettings();
  const sectors = [...new Set(AGENTS.map((a) => a.sector))];
  return (
    <>
      <PageHead eyebrow="Fluxo escrito" title="Agentes ativos" />
      <p className="-mt-3 mb-5 max-w-2xl text-[14px] text-soft">
        Cada cartão é um agente com o fluxo escrito. Ligue ou desligue e ajuste o texto: a recepção segue o fluxo como instrução, palavra por
        palavra.
      </p>
      <div className="mb-6"><RunAgents /></div>
      <div className="space-y-8">
        {sectors.map((sec) => (
          <section key={sec}>
            <h2 className="mb-3 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-faint">{sec}</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {AGENTS.filter((a) => a.sector === sec).map((a) => (
                <AgentCard key={a.key} def={a} config={s.agents[a.key]} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
