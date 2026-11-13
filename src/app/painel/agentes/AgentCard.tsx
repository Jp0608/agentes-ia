"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import type { AgentDef } from "@/lib/agents";
import type { AgentConfig } from "@/lib/settings";
import { saveFlow, toggleAgent } from "../actions";

export function AgentCard({ def, config }: { def: AgentDef; config: AgentConfig }) {
  const [on, setOn] = useState(config.enabled);
  const [flow, setFlow] = useState(config.flow);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const c = def.color;
  return (
    <article className="card p-4" style={{ borderColor: `color-mix(in oklab, ${c} ${on ? 55 : 20}%, transparent)`, boxShadow: on ? `0 0 40px -22px ${c}` : undefined }}>
      <header className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `color-mix(in oklab, ${c} 16%, transparent)`, color: c }}><Icon name={def.icon} size={20} /></span>
        <h3 className="min-w-0 flex-1 text-[15.5px] font-semibold">{def.name}</h3>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={`${on ? "Desligar" : "Ligar"} ${def.name}`}
          disabled={pending}
          onClick={() => start(async () => { const next = !on; setOn(next); await toggleAgent(def.key, next); })}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-signal" : "bg-line"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </header>
      <p className="mt-3 text-[13px] text-soft"><b className="font-semibold text-ink">Quando:</b> {def.when}</p>
      {editing ? (
        <div className="mt-3">
          <label htmlFor={`flow-${def.key}`} className="label">Fluxo escrito (um passo por linha)</label>
          <textarea id={`flow-${def.key}`} className="field min-h-40 font-mono text-[13px] leading-relaxed" value={flow} onChange={(e) => setFlow(e.target.value)} />
          <div className="mt-2 flex gap-2">
            <button className="btn-main min-h-9" disabled={pending} onClick={() => start(async () => { const r = await saveFlow(def.key, flow); setMsg(r.ok); setEditing(false); })}>Salvar</button>
            <button className="btn-quiet min-h-9" onClick={() => { setFlow(config.flow); setEditing(false); }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {flow.split("\n").filter(Boolean).map((f, i) => (
            <li key={i} className="grid grid-cols-[20px_1fr] gap-2 text-[13.5px] leading-snug">
              <span className="grid h-[18px] place-items-center rounded-[5px] font-mono text-[10.5px] font-bold text-black" style={{ background: c }}>{i + 1}</span>
              <span>{f}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 flex gap-2 rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-[12.5px] leading-snug">
        <Icon name="person" size={16} className="mt-px text-warn" /> {def.human}
      </p>
      {!editing && (
        <div className="mt-3 flex items-center gap-3">
          <button className="btn-quiet min-h-8 -ml-2 text-[13px]" onClick={() => setEditing(true)}><Icon name="edit" size={16} /> Editar fluxo</button>
          {msg && <span className="text-[12.5px] text-signal">{msg}</span>}
        </div>
      )}
    </article>
  );
}
