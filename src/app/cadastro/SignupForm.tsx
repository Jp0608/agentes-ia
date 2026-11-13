"use client";

import { useActionState } from "react";
import { signup } from "../painel/actions";

export function SignupForm() {
  const [state, run, pending] = useActionState(signup, null);
  return (
    <form action={run} className="mt-6 space-y-4">
      <div>
        <label htmlFor="businessName" className="label">Nome do negócio</label>
        <input id="businessName" name="businessName" required autoFocus maxLength={80} className="field" autoComplete="organization" />
      </div>
      <div>
        <label htmlFor="email" className="label">E-mail</label>
        <input id="email" name="email" type="email" required className="field" autoComplete="email" inputMode="email" />
      </div>
      <div>
        <label htmlFor="senha" className="label">Senha</label>
        <input id="senha" name="senha" type="password" required minLength={8} className="field" autoComplete="new-password" />
        <p className="mt-1.5 text-[14px] text-faint">Pelo menos 8 caracteres.</p>
      </div>
      <div>
        <label htmlFor="confirmar" className="label">Confirmar senha</label>
        <input id="confirmar" name="confirmar" type="password" required minLength={8} className="field" autoComplete="new-password" />
      </div>
      {state?.error && <p role="alert" className="text-[15px] text-alert">{state.error}</p>}
      <button className="btn-main mt-2 w-full" disabled={pending}>{pending ? "Criando…" : "Criar conta"}</button>
    </form>
  );
}
