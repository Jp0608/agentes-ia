import { ActionForm, ActButton, PageHead, StatusTag } from "@/components/ui";
import { listQuotes } from "@/lib/quotes";
import { getSettings } from "@/lib/settings";
import { brl, dayKey } from "@/lib/time";
import { newQuote, sendQuoteNow } from "../actions";

export const metadata = { title: "Orçamentos" };

export default async function Page() {
  const s = await getSettings();
  const quotes = await listQuotes();
  return (
    <>
      <PageHead eyebrow="Orçamentos" title="Valor explicado e cobrado 3 dias depois" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="card p-4">
          {quotes.length === 0 ? (
            <p className="py-6 text-center text-[14px] text-faint">Nenhum orçamento ainda.</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {quotes.map((x) => (
                <li key={x.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold">{x.title}</span>
                      <span className="block text-[12.5px] text-faint">{x.client_name || x.client_phone} · {x.items.length} itens · {x.sent_at ? `enviado em ${dayKey(new Date(x.sent_at), s.timezone).split("-").reverse().join("/")}` : "não enviado"}{x.followups ? ` · ${x.followups} retorno(s)` : ""}</span>
                    </span>
                    <span className="num font-mono text-[14px] font-semibold">{brl(x.total)}</span>
                    <StatusTag status={x.status} />
                    {x.status === "rascunho" && <ActButton onRun={sendQuoteNow.bind(null, x.id)} className="btn-soft min-h-8 px-3 text-[13px]">Enviar</ActButton>}
                  </div>
                  {x.explanation && <p className="mt-2 text-[13px] text-soft">“{x.explanation}”</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="card h-fit p-4">
          <h2 className="mb-3 text-[15px] font-semibold">Novo orçamento</h2>
          <ActionForm action={newQuote} submit="Salvar" className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label" htmlFor="q-phone">WhatsApp</label><input id="q-phone" name="phone" className="field" required inputMode="tel" /></div>
              <div><label className="label" htmlFor="q-name">Nome</label><input id="q-name" name="name" className="field" /></div>
            </div>
            <div><label className="label" htmlFor="q-title">Título</label><input id="q-title" name="title" className="field" placeholder="Ex.: Tratamento do dente 36" /></div>
            <div>
              <label className="label" htmlFor="q-items">Itens (um por linha: nome | valor)</label>
              <textarea id="q-items" name="items" className="field min-h-28 font-mono text-[13px]" required placeholder={`${s.services[0]?.name ?? "Serviço"} | ${s.services[0]?.price ?? 100}\nOutro item | 250`} />
            </div>
            <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" name="sendNow" defaultChecked className="h-4 w-4 accent-[#4ade80]" /> Mandar agora pelo WhatsApp, com a explicação em palavras simples</label>
          </ActionForm>
        </aside>
      </div>
    </>
  );
}
