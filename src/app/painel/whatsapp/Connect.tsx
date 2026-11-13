"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { ActButton } from "@/components/ui";
import { whatsappConnect, whatsappDisconnect } from "../actions";

export function Connect({ connected, phone, profile }: { connected: boolean; phone: string; profile: string }) {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Enquanto o QR ou o código está na tela, confere a cada 4 s se já conectou.
  useEffect(() => {
    if (!qr && !code) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [qr, code, router]);

  useEffect(() => {
    if (connected) {
      setQr(null);
      setCode(null);
    }
  }, [connected]);

  if (connected) {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-[19px] font-semibold text-signal"><Icon name="check_circle" size={26} fill /> WhatsApp conectado</p>
        <p className="break-words text-[16px] text-soft">{profile && <b className="text-ink">{profile} </b>}{phone && <span className="font-mono">+{phone}</span>}</p>
        <p className="text-[15px] text-soft">A assistente já responde e manda mensagens por esse número.</p>
        <ActButton onRun={whatsappDisconnect} className="btn-danger" confirmText="Desconectar o WhatsApp?">Desconectar</ActButton>
      </div>
    );
  }
  const fmtCode = (c: string) => (c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c);

  return (
    <div className="space-y-6">
      <section className="box space-y-3 p-4">
        <h3 className="flex items-center gap-2 text-[17px] font-semibold"><Icon name="smartphone" size={22} className="text-signal" /> Conectar pelo celular, com código</h3>
        <p className="text-[15px] text-soft">Use esta opção se você está no mesmo celular do WhatsApp do negócio.</p>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              setError(null);
              setQr(null);
              const r = await whatsappConnect(number);
              if ("error" in r && r.error) setError(r.error);
              else if ("code" in r) {
                setCode(r.code ?? null);
                if (r.state === "open") router.refresh();
              }
            });
          }}
        >
          <label htmlFor="wa-number" className="sr-only">Número do WhatsApp do negócio</label>
          <input
            id="wa-number"
            className="field flex-1"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Número do WhatsApp, ex.: (11) 99999-0000"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            required
          />
          <button type="submit" className="btn-main w-full sm:w-auto" disabled={pending || !number.trim()}>
            <Icon name="pin" size={22} /> {pending && !qr ? "Gerando…" : code ? "Gerar outro código" : "Gerar código"}
          </button>
        </form>
        {code && (
          <div className="space-y-3">
            <p className="select-all rounded-xl border border-signal/40 bg-signal/10 py-4 text-center font-mono text-[34px] font-bold tracking-[0.2em] text-signal">{fmtCode(code)}</p>
            <button type="button" className="btn-soft w-full sm:w-auto" onClick={() => navigator.clipboard?.writeText(code).catch(() => null)}>
              <Icon name="content_copy" size={20} /> Copiar código
            </button>
            <ol className="list-decimal space-y-2 pl-5 text-[16px] leading-snug text-soft">
              <li>Abra o WhatsApp do negócio → <b className="text-ink">Aparelhos conectados</b> → <b className="text-ink">Conectar aparelho</b>.</li>
              <li>Toque em <b className="text-ink">Conectar com número de telefone</b> (embaixo da câmera).</li>
              <li>Digite o código acima. Esta tela atualiza sozinha quando conectar.</li>
            </ol>
            <p className="text-[14px] text-faint">O código vale por poucos minutos. Se expirar, gere outro.</p>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-[17px] font-semibold"><Icon name="qr_code_2" size={22} className="text-signal" /> Ou conectar com QR code</h3>
        <ol className="list-decimal space-y-2 pl-5 text-[16px] leading-snug text-soft">
          <li>Toque em <b className="text-ink">Gerar QR code</b>.</li>
          <li>No celular do negócio, abra o WhatsApp → <b className="text-ink">Aparelhos conectados</b> → <b className="text-ink">Conectar aparelho</b>.</li>
          <li>Aponte a câmera para o código. Esta tela atualiza sozinha.</li>
        </ol>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR code para conectar o WhatsApp" className="mx-auto aspect-square w-full max-w-72 rounded-xl bg-white p-2 sm:mx-0" />
        )}
        <button
          type="button"
          className="btn-soft w-full sm:w-auto"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              setCode(null);
              const r = await whatsappConnect();
              if ("error" in r && r.error) setError(r.error);
              else if ("qr" in r) { setQr(r.qr ?? null); if (r.state === "open") router.refresh(); }
            })
          }
        >
          <Icon name="qr_code_2" size={22} /> {pending && !code ? "Gerando…" : qr ? "Gerar outro QR code" : "Gerar QR code"}
        </button>
      </section>
      {error && <p role="alert" className="text-[15px] text-alert">{error}</p>}
    </div>
  );
}
