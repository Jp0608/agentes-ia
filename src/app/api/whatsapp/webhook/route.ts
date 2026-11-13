import { after } from "next/server";
import { audioOf, voiceNoteText } from "@/lib/audio";
import { handleInbound } from "@/lib/inbound";
import { maybeRunAgents } from "@/lib/jobs";
import { getSettings } from "@/lib/settings";
import { withTenant } from "@/lib/tenant";
import { evoServer, instanceOf, jidDigits, logActivity, markRead, webhookTenant } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Key = { id?: string; fromMe?: boolean; remoteJid?: string; remoteJidAlt?: string; senderPn?: string };
type Msg = {
  key?: Key;
  pushName?: string;
  messageTimestamp?: number | string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    buttonsResponseMessage?: { selectedDisplayText?: string };
    listResponseMessage?: { title?: string };
    audioMessage?: unknown;
    imageMessage?: { caption?: string };
  };
};
type Payload = { event?: string; instance?: string; data?: Msg | Msg[] | { state?: string } };

/** Eventos da Evolution API: mensagens novas e mudanças de conexão. */
export async function POST(req: Request) {
  const params = new URL(req.url).searchParams;
  if (!params.get("key")) return new Response("Not found", { status: 404 });
  const payload = (await req.json().catch(() => null)) as Payload | null;
  // Cada negócio tem a própria instância e a própria chave no endereço do webhook.
  const tenant = webhookTenant(params, typeof payload?.instance === "string" ? payload.instance : undefined);
  if (!tenant) return new Response("Not found", { status: 404 });
  if (!payload) return new Response("ok");
  const event = (payload.event ?? "").toLowerCase().replace(/_/g, ".");

  const run = () => withTenant(tenant, async () => {
    if (event === "connection.update") {
      const state = (payload.data as { state?: string })?.state;
      if (state === "open") await logActivity("sistema", "WhatsApp conectado");
      if (state === "close") await logActivity("sistema", "O WhatsApp desconectou. Conecte de novo pelo QR code.");
      return;
    }
    if (event !== "messages.upsert") return;
    for (const m of Array.isArray(payload.data) ? payload.data : [payload.data as Msg]) {
      const k = m?.key;
      if (!k?.remoteJid || k.fromMe) continue;
      if (/@(g\.us|broadcast|newsletter)$/.test(k.remoteJid)) continue;
      const jid = k.remoteJid.endsWith("@lid") ? (k.remoteJidAlt ?? k.senderPn) : k.remoteJid;
      const phone = jidDigits(jid);
      if (phone.length < 10) continue;
      const ts = Number(m.messageTimestamp);
      if (ts && Date.now() / 1000 - ts > 600) continue; // sincronização de mensagens antigas
      const msg = m.message;
      let text =
        msg?.conversation ??
        msg?.extendedTextMessage?.text ??
        msg?.buttonsResponseMessage?.selectedDisplayText ??
        msg?.listResponseMessage?.title ??
        msg?.imageMessage?.caption ??
        "";
      // ---- Áudio: transcreve e segue como mensagem de texto (ver lib/audio.ts) ----
      if (!text && audioOf(msg)) text = await voiceNoteText(m, { server: evoServer(), instance: instanceOf(tenant) });
      // ---- fim do áudio ----
      if (!text.trim()) continue;
      if (k.id) await markRead(k.remoteJid, k.id).catch(() => {});
      try {
        await handleInbound({ phone, name: m.pushName, text: text.slice(0, 2000), extId: k.id });
      } catch (e) {
        console.error("erro ao responder", phone, e);
        await logActivity("sistema", `Erro ao responder ${phone}: ${(e as Error).message}`, phone);
      }
    }
    await maybeRunAgents(await getSettings()).catch(() => null);
  });
  // Na Vercel o trabalho segue depois da resposta. Em outras hospedagens (Netlify) a função é
  // encerrada assim que responde, então a mensagem é atendida antes de responder ao webhook.
  if (process.env.VERCEL) after(run);
  else await run().catch((e) => console.error("webhook do WhatsApp:", e));
  return new Response("ok");
}
