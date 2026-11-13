"use client";

import { useState } from "react";
import { EMOJI_LABELS, LENGTH_LABELS, renderGreeting, TONES, TREATMENT_LABELS, type Persona, type Tone } from "@/lib/persona";

/** Tom e mensagens da recepção, com prévia ao vivo da primeira mensagem. */
export function PersonaFields({ initial, businessName, services }: { initial: Persona; businessName: string; services: string }) {
  const [p, setP] = useState<Persona>(initial);
  const set = <K extends keyof Persona>(k: K, v: Persona[K]) => setP((cur) => ({ ...cur, [k]: v }));
  const preview = renderGreeting(p, { nome: "Maria", negocio: businessName || "seu negócio", servicos: services || "seus serviços" });

  return (
    <section className="card space-y-5 p-5">
      <div>
        <h2 className="text-[15px] font-semibold">Atendimento e tom</h2>
        <p className="mt-1 text-[13px] text-soft">Como a recepção fala com os clientes no WhatsApp. A prévia ao lado muda enquanto você ajusta.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <div>
            <span className="label">Tom de voz</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(TONES) as Tone[]).map((t) => (
                <label
                  key={t}
                  className={`cursor-pointer rounded-xl border px-3 py-2 text-[13px] transition ${p.tone === t ? "border-[#4ade80] bg-[#4ade80]/10" : "border-white/10 hover:border-white/25"}`}
                >
                  <input type="radio" name="p_tone" value={t} checked={p.tone === t} onChange={() => set("tone", t)} className="sr-only" />
                  <span className="block font-semibold">{TONES[t].label}</span>
                  <span className="block text-faint">{TONES[t].hint}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="p_assistantName">Nome da atendente (opcional)</label>
              <input id="p_assistantName" name="p_assistantName" className="field" value={p.assistantName} onChange={(e) => set("assistantName", e.target.value)} placeholder="Ex.: Ana" />
            </div>
            <div>
              <label className="label" htmlFor="p_treatment">Como chamar o cliente</label>
              <select id="p_treatment" name="p_treatment" className="field" value={p.treatment} onChange={(e) => set("treatment", e.target.value as Persona["treatment"])}>
                {Object.entries(TREATMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="p_emojis">Emojis</label>
              <select id="p_emojis" name="p_emojis" className="field" value={p.emojis} onChange={(e) => set("emojis", e.target.value as Persona["emojis"])}>
                {Object.entries(EMOJI_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="p_length">Tamanho das mensagens</label>
              <select id="p_length" name="p_length" className="field" value={p.length} onChange={(e) => set("length", e.target.value as Persona["length"])}>
                {Object.entries(LENGTH_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <label className="flex items-start gap-2 text-[13.5px]">
            <input type="checkbox" name="p_proactive" checked={p.proactive} onChange={(e) => set("proactive", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#4ade80]" />
            <span>
              <b>Atendimento ativo</b>: já na primeira mensagem mostra os serviços e, assim que souber o serviço, oferece os horários livres mais próximos.
            </span>
          </label>

          <div>
            <label className="label" htmlFor="p_greeting">Primeira mensagem (deixe vazio para usar a sugerida)</label>
            <textarea id="p_greeting" name="p_greeting" className="field min-h-20" value={p.greeting} onChange={(e) => set("greeting", e.target.value)} placeholder="Oi {nome}! Aqui é {assistente}, da {negocio}. Temos: {servicos}. Qual você quer e pra quando?" />
            <p className="mt-1 text-[12px] text-faint">Atalhos: {"{nome}"} {"{negocio}"} {"{assistente}"} {"{servicos}"}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="p_closing">Depois de marcar</label>
              <input id="p_closing" name="p_closing" className="field" value={p.closing} onChange={(e) => set("closing", e.target.value)} placeholder="Te esperamos! Qualquer coisa é só chamar." />
            </div>
            <div>
              <label className="label" htmlFor="p_afterHours">Fora do horário</label>
              <input id="p_afterHours" name="p_afterHours" className="field" value={p.afterHours} onChange={(e) => set("afterHours", e.target.value)} placeholder="Estamos fechados agora, mas já posso marcar pra você." />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="p_avoid">Nunca falar</label>
            <input id="p_avoid" name="p_avoid" className="field" value={p.avoid} onChange={(e) => set("avoid", e.target.value)} placeholder="Ex.: gírias, desconto, preço de concorrente" />
          </div>
          <div>
            <label className="label" htmlFor="p_extra">Instruções extras para a atendente</label>
            <textarea id="p_extra" name="p_extra" className="field min-h-20" value={p.extra} onChange={(e) => set("extra", e.target.value)} placeholder="Ex.: sempre lembrar que aceitamos Pix e cartão; para clareamento, avisar que precisa de avaliação antes." />
          </div>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <span className="label">Prévia no WhatsApp</span>
          <div className="rounded-2xl border border-white/10 bg-[#0b141a] p-3">
            <div className="ml-auto mb-2 w-fit rounded-xl bg-[#005c4b] px-3 py-2 text-[13px] text-white">Oi</div>
            <div className="w-fit max-w-[95%] whitespace-pre-wrap rounded-xl bg-[#202c33] px-3 py-2 text-[13px] text-white">{preview}</div>
          </div>
          <p className="mt-2 text-[12px] text-faint">A IA adapta o texto à conversa, mantendo o tom e o sentido.</p>
        </div>
      </div>
    </section>
  );
}
