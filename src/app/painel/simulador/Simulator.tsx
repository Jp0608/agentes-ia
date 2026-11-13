"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { AGENTS } from "@/lib/agents";

type Msg = { id: number; direction: string; body: string; agent: string | null; created_at: string };
type Data = { chat: Msg[]; owner: Msg[]; clients: { phone: string; name: string }[] };

const time = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const agentName = (k: string | null) => AGENTS.find((a) => a.key === k);

export function Simulator({ me, business, owner }: { me: string; business: string; owner: string }) {
  const [phone, setPhone] = useState(me);
  const [data, setData] = useState<Data>({ chat: [], owner: [], clients: [] });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/sim?phone=${encodeURIComponent(phone)}`, { cache: "no-store" });
    if (r.ok) setData(await r.json());
  }, [phone]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [data.chat.length]);

  async function sendMsg(e?: React.FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setText("");
    setSending(true);
    setError(null);
    setData((d) => ({ ...d, chat: [...d.chat, { id: -Date.now(), direction: "in", body, agent: null, created_at: new Date().toISOString() }] }));
    const r = await fetch("/api/sim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, text: body }) });
    if (!r.ok) setError(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Não deu certo.");
    await load();
    setSending(false);
  }

  const who = data.clients.find((c) => c.phone === phone)?.name || "Você (cliente novo)";

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <section className="card flex h-[640px] min-w-0 flex-col overflow-hidden">
        <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-signal/15 text-signal"><Icon name="storefront" size={19} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14.5px] font-semibold">{business}</span>
            <span className="block text-[12px] text-faint">conversando como: {who}</span>
          </span>
          <label htmlFor="sim-who" className="sr-only">Conversar como</label>
          <select id="sim-who" className="field min-h-9 w-auto max-w-[220px] py-1 text-[13px]" value={phone} onChange={(e) => setPhone(e.target.value)}>
            <option value={me}>Você (cliente novo)</option>
            {data.clients.filter((c) => c.phone !== me).map((c) => (
              <option key={c.phone} value={c.phone}>{c.name || c.phone}</option>
            ))}
          </select>
        </header>
        <div className="flex-1 space-y-2 overflow-y-auto bg-[#0b100e] px-4 py-4">
          {data.chat.length === 0 && (
            <p className="mx-auto mt-10 max-w-xs text-center text-[13.5px] text-faint">
              Mande uma mensagem como um cliente faria. Exemplo: “oi, tem horário amanhã de manhã?”
            </p>
          )}
          {data.chat.map((m) => {
            const out = m.direction === "out";
            const ag = agentName(m.agent);
            return (
              <div key={m.id} className={`flex ${out ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-[14px] leading-snug ${out ? "rounded-tl-sm bg-raise-2" : "rounded-tr-sm bg-signal/20"}`}>
                  {out && ag && <span className="mb-0.5 block text-[11px] font-semibold" style={{ color: ag.color }}>{ag.name}</span>}
                  <span className="whitespace-pre-wrap break-words">{m.body}</span>
                  <span className="mt-0.5 block text-right text-[10.5px] text-faint">{time(m.created_at)}</span>
                </div>
              </div>
            );
          })}
          {sending && <p className="text-[12.5px] text-faint">digitando…</p>}
          <div ref={endRef} />
        </div>
        <form onSubmit={sendMsg} className="flex gap-2 border-t border-line p-3">
          <label htmlFor="sim-text" className="sr-only">Mensagem</label>
          <input id="sim-text" className="field" placeholder="Escreva como cliente…" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
          <button className="btn-main px-3" disabled={sending || !text.trim()} aria-label="Enviar"><Icon name="send" size={18} /></button>
        </form>
        {error && <p role="alert" className="px-4 pb-3 text-[13px] text-alert">{error}</p>}
      </section>

      <section className="card flex h-[640px] min-w-0 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-warn/15 text-warn"><Icon name="person" size={19} /></span>
          <span>
            <span className="block text-[14.5px] font-semibold">WhatsApp de {owner}</span>
            <span className="block text-[12px] text-faint">página da manhã e alertas para o dono</span>
          </span>
        </header>
        <div className="flex-1 space-y-2 overflow-y-auto bg-[#0b100e] px-4 py-4">
          {data.owner.length === 0 && <p className="mx-auto mt-10 max-w-xs text-center text-[13.5px] text-faint">Nada ainda. Rode os agentes ou peça para falar com o dono no chat.</p>}
          {data.owner.map((m) => {
            const ag = agentName(m.agent);
            return (
              <div key={m.id} className="max-w-[92%] rounded-2xl rounded-tl-sm bg-raise-2 px-3 py-2 text-[14px] leading-snug">
                {ag && <span className="mb-0.5 block text-[11px] font-semibold" style={{ color: ag.color }}>{ag.name}</span>}
                <span className="whitespace-pre-wrap break-words">{m.body}</span>
                <span className="mt-0.5 block text-right text-[10.5px] text-faint">{time(m.created_at)}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
