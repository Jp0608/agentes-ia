"use client";

import { useActionState } from "react";
import { login } from "../painel/actions";

export function LoginForm() {
  const [state, run, pending] = useActionState(login, null);
  return (
    <form action={run} className="mt-6 space-y-3">
      <div>
        <label htmlFor="email" className="label">E-mail</label>
        <input id="email" name="email" type="email" required autoFocus className="field" autoComplete="email" inputMode="email" />
      </div>
      <div>
        <label htmlFor="senha" className="label">Senha</label>
        <input id="senha" name="senha" type="password" required className="field" autoComplete="current-password" />
      </div>
      {state?.error && <p role="alert" className="text-[13px] text-alert">{state.error}</p>}
      <button className="btn-main w-full" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
