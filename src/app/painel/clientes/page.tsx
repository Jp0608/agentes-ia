import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ActionForm, PageHead } from "@/components/ui";
import { q } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { tenantId } from "@/lib/tenant";
import { dayKey } from "@/lib/time";
import { newClient } from "../actions";

export const metadata = { title: "Clientes" };

type Row = { id: number; phone: string; name: string; simulated: boolean; opt_out: boolean; visits: string; last: Date | null; next: Date | null; noshows: string };

export default async function Page() {
  const s = await getSettings();
  const rows = await q<Row>(
    `select c.id, c.phone, c.name, c.simulated, c.opt_out,
       count(a.id) filter (where a.status = 'concluido') as visits,
       count(a.id) filter (where a.status = 'faltou') as noshows,
       max(a.starts_at) filter (where a.status = 'concluido') as last,
       min(a.starts_at) filter (where a.status in ('marcado','confirmado') and a.starts_at > now()) as next
     from clients c left join appointments a on a.client_id = c.id and a.tenant_id = c.tenant_id
     where c.tenant_id = $1 group by c.id order by c.name limit 500`,
    [await tenantId()],
  );
  const fmt = (d: Date | null) => (d ? dayKey(new Date(d), s.timezone).split("-").reverse().join("/") : "—");
  const visits = (r: Row) => `${r.visits} ${Number(r.visits) === 1 ? "atendimento" : "atendimentos"}`;
  return (
    <>
      <PageHead eyebrow="Clientes" title={`${rows.length} cadastrados`}>
        <a href="#novo" className="btn-main xl:hidden"><Icon name="person_add" size={20} /> Novo cliente</a>
      </PageHead>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Celular: um cartão por cliente. */}
        <ul className="card divide-y divide-line-soft md:hidden">
          {rows.length === 0 && <li className="p-4 text-[15px] text-faint">Nenhum cliente ainda.</li>}
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/painel/conversas?tel=${r.phone}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-raise">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-semibold">{r.name || "Sem nome"}</span>
                  <span className="block font-mono text-[14px] text-soft">{r.phone}</span>
                  {(r.simulated || r.opt_out) && (
                    <span className="mt-0.5 block text-[13px]">
                      {r.simulated && <span className="mr-2 text-faint">simulado</span>}
                      {r.opt_out && <span className="text-warn">não quer mensagens</span>}
                    </span>
                  )}
                  <span className="mt-1 block text-[14px] leading-snug text-soft">
                    {visits(r)}{Number(r.noshows) > 0 && <span className="text-alert"> · {r.noshows} falta(s)</span>}
                    {r.next && <> · próximo {fmt(r.next)}</>}
                    {!r.next && r.last && <> · último {fmt(r.last)}</>}
                  </span>
                </span>
                <Icon name="chevron_right" size={24} className="text-faint" />
              </Link>
            </li>
          ))}
        </ul>
        {/* Computador: tabela. */}
        <section className="card hidden overflow-x-auto p-2 md:block">
          <table className="w-full text-left text-[15px]">
            <thead className="text-[13px] text-faint">
              <tr><th className="px-3 py-2 font-medium">Nome</th><th className="px-3 py-2 font-medium">WhatsApp</th><th className="px-3 py-2 font-medium">Atendimentos</th><th className="px-3 py-2 font-medium">Último</th><th className="px-3 py-2 font-medium">Próximo</th></tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2.5 font-semibold">
                    <Link href={`/painel/conversas?tel=${r.phone}`} className="hover:text-signal">{r.name || "Sem nome"}</Link>
                    {r.simulated && <span className="ml-1.5 text-[13px] font-normal text-faint">simulado</span>}
                    {r.opt_out && <span className="ml-1.5 text-[13px] font-normal text-warn">não quer mensagens</span>}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[14px] text-soft">{r.phone}</td>
                  <td className="num px-3 py-2.5">{r.visits}{Number(r.noshows) > 0 && <span className="text-alert"> · {r.noshows} falta(s)</span>}</td>
                  <td className="px-3 py-2.5 text-soft">{fmt(r.last)}</td>
                  <td className="px-3 py-2.5 text-soft">{fmt(r.next)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <aside id="novo" className="card h-fit scroll-mt-24 p-4 sm:p-5">
          <h2 className="mb-3 text-[19px] font-semibold">Novo cliente</h2>
          <ActionForm action={newClient} submit="Salvar" className="space-y-3">
            <div><label className="label" htmlFor="c-name">Nome</label><input id="c-name" name="name" className="field" /></div>
            <div><label className="label" htmlFor="c-phone">WhatsApp</label><input id="c-phone" name="phone" className="field" required inputMode="tel" /></div>
          </ActionForm>
        </aside>
      </div>
    </>
  );
}
