import Link from "next/link";
import { ActionForm, PageHead } from "@/components/ui";
import { q } from "@/lib/db";
import { getSettings } from "@/lib/settings";
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
     from clients c left join appointments a on a.client_id = c.id group by c.id order by c.name limit 500`,
  );
  const fmt = (d: Date | null) => (d ? dayKey(new Date(d), s.timezone).split("-").reverse().join("/") : "—");
  return (
    <>
      <PageHead eyebrow="Clientes" title={`${rows.length} cadastrados`} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card overflow-x-auto p-2">
          <table className="w-full min-w-[560px] text-left text-[13.5px]">
            <thead className="text-[12px] text-faint">
              <tr><th className="px-3 py-2 font-medium">Nome</th><th className="px-3 py-2 font-medium">WhatsApp</th><th className="px-3 py-2 font-medium">Atendimentos</th><th className="px-3 py-2 font-medium">Último</th><th className="px-3 py-2 font-medium">Próximo</th></tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-semibold">
                    <Link href={`/painel/conversas?tel=${r.phone}`} className="hover:text-signal">{r.name || "Sem nome"}</Link>
                    {r.simulated && <span className="ml-1.5 text-[11px] font-normal text-faint">simulado</span>}
                    {r.opt_out && <span className="ml-1.5 text-[11px] font-normal text-warn">não quer mensagens</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-[12.5px] text-soft">{r.phone}</td>
                  <td className="num px-3 py-2">{r.visits}{Number(r.noshows) > 0 && <span className="text-alert"> · {r.noshows} falta(s)</span>}</td>
                  <td className="px-3 py-2 text-soft">{fmt(r.last)}</td>
                  <td className="px-3 py-2 text-soft">{fmt(r.next)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <aside className="card h-fit p-4">
          <h2 className="mb-3 text-[15px] font-semibold">Novo cliente</h2>
          <ActionForm action={newClient} submit="Salvar" className="space-y-3">
            <div><label className="label" htmlFor="c-name">Nome</label><input id="c-name" name="name" className="field" /></div>
            <div><label className="label" htmlFor="c-phone">WhatsApp</label><input id="c-phone" name="phone" className="field" required inputMode="tel" /></div>
          </ActionForm>
        </aside>
      </div>
    </>
  );
}
