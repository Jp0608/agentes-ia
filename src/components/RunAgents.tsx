"use client";

import { useState, useTransition } from "react";
import { demoClear, demoSeed, runNow } from "@/app/painel/actions";
import { Icon } from "./Icon";
import { ActButton } from "./ui";

const LABEL: Record<string, string> = {
  concluidos: "atendimentos concluídos",
  lembretes: "lembretes",
  avaliacoes: "pedidos de avaliação",
  retornos: "retornos",
  orcamentos: "retornos de orçamento",
  manha: "página da manhã",
};

/** Botões para rodar os agentes na hora (o cron roda sozinho a cada 10 minutos). */
export function RunAgents({ demo }: { demo?: boolean }) {
  const [pending, start] = useTransition();
  const [report, setReport] = useState<string | null>(null);
  const run = (force: boolean) =>
    start(async () => {
      const r = await runNow(force);
      const done = Object.entries(r).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${LABEL[k] ?? k}`);
      setReport(done.length ? `Feito: ${done.join(", ")}.` : "Nada na hora agora.");
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn-soft" disabled={pending} onClick={() => run(false)} title="Roda só o que está na hora">
        <Icon name="play_arrow" size={18} /> Rodar automações
      </button>
      <button className="btn-main" disabled={pending} onClick={() => run(true)} title="Ignora a janela de horário de cada agente">
        <Icon name="bolt" size={18} /> {pending ? "Rodando…" : "Disparar lembretes e retornos agora"}
      </button>
      {demo && (
        <>
          <ActButton onRun={demoSeed} className="btn-quiet"><Icon name="science" size={18} /> Criar dados de demonstração</ActButton>
          <ActButton onRun={demoClear} className="btn-quiet" confirmText="Apagar os clientes simulados?"><Icon name="delete" size={18} /> Limpar demonstração</ActButton>
        </>
      )}
      {report && <span role="status" className="text-[13px] text-soft">{report}</span>}
    </div>
  );
}
