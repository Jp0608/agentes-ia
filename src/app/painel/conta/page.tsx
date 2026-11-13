import { Icon } from "@/components/Icon";
import { ActionForm, PageHead } from "@/components/ui";
import { getAccount } from "@/lib/accounts";
import { requireSession } from "@/lib/auth";
import { changePassword, logout, saveAccount } from "../actions";

export const metadata = { title: "Conta" };

export default async function Page() {
  const { accountId } = await requireSession();
  const a = await getAccount(accountId);
  return (
    <>
      <PageHead eyebrow="Conta" title="Sua conta" />
      {!a ? (
        <section className="card max-w-2xl space-y-3 p-5">
          <p className="text-[14px] text-soft">Não encontrei esta conta. Saia e entre de novo.</p>
          <form action={logout}><button className="btn-soft"><Icon name="logout" size={17} /> Sair</button></form>
        </section>
      ) : (
        <div className="max-w-2xl space-y-6">
          <ActionForm action={saveAccount} submit="Salvar" className="card space-y-4 p-5">
            <h2 className="text-[15px] font-semibold">Dados de acesso</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="name">Nome</label><input id="name" name="name" className="field" defaultValue={a.name} required maxLength={80} autoComplete="name" /></div>
              <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" className="field" defaultValue={a.email} required autoComplete="email" /></div>
            </div>
            <p className="text-[12px] text-faint">O e-mail é o que você usa para entrar. O nome do negócio que os clientes veem fica em Configurar.</p>
          </ActionForm>

          <ActionForm action={changePassword} submit="Trocar senha" className="card space-y-4 p-5">
            <h2 className="text-[15px] font-semibold">Senha</h2>
            <div><label className="label" htmlFor="atual">Senha atual</label><input id="atual" name="atual" type="password" className="field" required autoComplete="current-password" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="nova">Nova senha</label><input id="nova" name="nova" type="password" className="field" required minLength={8} autoComplete="new-password" /></div>
              <div><label className="label" htmlFor="confirmar">Confirmar nova senha</label><input id="confirmar" name="confirmar" type="password" className="field" required minLength={8} autoComplete="new-password" /></div>
            </div>
          </ActionForm>

          <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <p className="text-[14px] text-soft">Sair desta conta neste aparelho.</p>
            <form action={logout}><button className="btn-soft"><Icon name="logout" size={17} /> Sair</button></form>
          </section>
        </div>
      )}
    </>
  );
}
