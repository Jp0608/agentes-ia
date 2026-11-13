import "server-only";
import { q } from "./db";
import { explainQuote } from "./brain";
import { getClient } from "./booking";
import type { Settings } from "./settings";
import { brl } from "./time";
import { logActivity, send } from "./whatsapp";

export type QuoteItem = { name: string; price: number };
export type Quote = {
  id: number;
  client_id: number;
  title: string;
  items: QuoteItem[];
  total: number;
  explanation: string;
  status: "rascunho" | "enviado" | "aceito" | "recusado";
  sent_at: Date | null;
  followups: number;
  created_at: Date;
  client_name: string;
  client_phone: string;
};

export async function listQuotes() {
  const rows = await q<Quote>(
    `select qt.*, c.name as client_name, c.phone as client_phone from quotes qt join clients c on c.id = qt.client_id order by qt.created_at desc limit 100`,
  );
  return rows.map((r) => ({ ...r, id: Number(r.id), total: Number(r.total), items: (typeof r.items === "string" ? JSON.parse(r.items) : r.items) as QuoteItem[] }));
}

export async function createQuote(clientId: number, title: string, items: QuoteItem[]) {
  const total = items.reduce((a, i) => a + (Number(i.price) || 0), 0);
  const rows = await q<{ id: number }>("insert into quotes (client_id, title, items, total) values ($1, $2, $3, $4) returning id", [
    clientId,
    title,
    JSON.stringify(items),
    total,
  ]);
  return Number(rows[0].id);
}

/** Agente de orçamentos: explica em palavras simples e manda pelo WhatsApp. */
export async function sendQuote(s: Settings, id: number) {
  const quote = (await listQuotes()).find((x) => x.id === id);
  if (!quote) return;
  const c = await getClient(quote.client_id);
  if (!c) return;
  const explanation = quote.explanation || (await explainQuote(s, quote.title, quote.items).catch(() => ""));
  const first = c.name.split(" ")[0];
  const text = [
    `${first ? `Oi, ${first}!` : "Oi!"} Segue o orçamento de ${quote.title}:`,
    ...quote.items.map((i) => `• ${i.name}: ${brl(i.price)}`),
    `Total: ${brl(quote.total)}`,
    explanation ? `\n${explanation}` : "",
    "\nQualquer dúvida, é só me chamar aqui. Se quiser, já reservo o primeiro horário.",
  ]
    .filter(Boolean)
    .join("\n");
  await send(c.phone, text, "orcamentos", { simulated: c.simulated });
  await q("update quotes set status = 'enviado', sent_at = now(), explanation = $2 where id = $1", [id, explanation]);
  await logActivity("orcamentos", `Orçamento "${quote.title}" (${brl(quote.total)}) enviado para ${c.name || c.phone}`, c.phone);
}
