"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/painel/actions";
import { Icon } from "./Icon";

/** Formulário ligado a uma server action, com aviso de salvo/erro. */
export function ActionForm({
  action,
  children,
  className = "",
  submit,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  submit: string;
}) {
  const [state, run] = useActionState(action, null);
  return (
    <form action={run} className={className}>
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Submit>{submit}</Submit>
        {state?.ok && (
          <span className="flex items-center gap-1.5 text-[15px] font-medium text-signal">
            <Icon name="check_circle" size={20} /> {state.ok}
          </span>
        )}
        {state?.error && (
          <span role="alert" className="flex items-center gap-1.5 text-[15px] font-medium text-alert">
            <Icon name="error" size={20} /> {state.error}
          </span>
        )}
      </div>
    </form>
  );
}

function Submit({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-main w-full sm:w-auto sm:px-6">
      {pending ? "Salvando…" : children}
    </button>
  );
}

/** Botão que chama uma ação e mostra "…" enquanto roda. */
export function ActButton({ onRun, children, className = "btn-soft", confirmText }: { onRun: () => Promise<unknown>; children: ReactNode; className?: string; confirmText?: string }) {
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState(false);
  if (confirmText && ask) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-[15px]">
        <span className="text-soft">{confirmText}</span>
        <button type="button" className="btn-danger min-h-11 px-4" disabled={pending} onClick={() => start(async () => { await onRun(); setAsk(false); })}>
          Sim
        </button>
        <button type="button" className="btn-soft min-h-11 px-4" onClick={() => setAsk(false)}>Não</button>
      </span>
    );
  }
  return (
    <button type="button" disabled={pending} className={className} onClick={() => (confirmText ? setAsk(true) : start(async () => { await onRun(); }))}>
      {pending ? "…" : children}
    </button>
  );
}

export function PageHead({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-[28px] font-bold leading-tight tracking-tight sm:text-[32px]">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

const STATUS: Record<string, { label: string; color: string }> = {
  marcado: { label: "Marcado", color: "#a9b3ae" },
  confirmado: { label: "Confirmado", color: "#aee627" },
  concluido: { label: "Atendido", color: "#60a5fa" },
  faltou: { label: "Faltou", color: "#fb7185" },
  cancelado: { label: "Cancelado", color: "#6f7a75" },
  rascunho: { label: "Rascunho", color: "#a9b3ae" },
  enviado: { label: "Enviado", color: "#fbbf24" },
  aceito: { label: "Aceito", color: "#aee627" },
  recusado: { label: "Recusado", color: "#fb7185" },
};

export function StatusTag({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, color: "#a9b3ae" };
  return (
    <span className="tag" style={{ color: s.color, borderColor: `color-mix(in oklab, ${s.color} 45%, transparent)`, background: `color-mix(in oklab, ${s.color} 12%, transparent)` }}>
      {s.label}
    </span>
  );
}
