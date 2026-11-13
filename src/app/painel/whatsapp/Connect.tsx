"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { ActButton } from "@/components/ui";
import { whatsappConnect, whatsappDisconnect } from "../actions";

export function Connect({ connected, phone, profile }: { connected: boolean; phone: string; profile: string }) {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Enquanto o QR está na tela, confere a cada 4 s se já conectou.
  useEffect(() => {
    if (!qr) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [qr, router]);

  useEffect(() => {
    if (connected) setQr(null);
  }, [connected]);

  if (connected) {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-signal"><Icon name="check_circle" size={20} fill /> WhatsApp conectado</p>
        <p className="text-[14px] text-soft">{profile && <b className="text-ink">{profile} </b>}{phone && <span className="font-mono">+{phone}</span>}</p>
        <p className="text-[13px] text-faint">A assistente já responde e manda mensagens por esse número.</p>
        <ActButton onRun={whatsappDisconnect} className="btn-danger" confirmText="Desconectar o WhatsApp?">Desconectar</ActButton>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-[14px] text-soft">
        <li>Toque em <b className="text-ink">Gerar QR code</b>.</li>
        <li>No celular do negócio, abra o WhatsApp → <b className="text-ink">Aparelhos conectados</b> → <b className="text-ink">Conectar aparelho</b>.</li>
        <li>Aponte a câmera para o código. Esta tela atualiza sozinha.</li>
      </ol>
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="QR code para conectar o WhatsApp" className="h-64 w-64 rounded-xl bg-white p-2" />
      )}
      <button
        className="btn-main"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await whatsappConnect();
            if ("error" in r && r.error) setError(r.error);
            else if ("qr" in r) { setQr(r.qr ?? null); if (r.state === "open") router.refresh(); }
          })
        }
      >
        <Icon name="qr_code_2" size={18} /> {pending ? "Gerando…" : qr ? "Gerar outro QR code" : "Gerar QR code"}
      </button>
      {error && <p role="alert" className="text-[13px] text-alert">{error}</p>}
    </div>
  );
}
