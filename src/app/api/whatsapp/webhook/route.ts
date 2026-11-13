import { after } from "next/server";
import { handleInbound } from "@/lib/inbound";
import { maybeRunAgents } from "@/lib/jobs";
import { getSettings } from "@/lib/settings";
import { jidDigits, logActivity, markRead, webhookKey } from "@/lib/whatsapp";

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
  if (new URL(req.url).searchParams.get("key") !== webhookKey()) return new Response("Not found", { status: 404 });
  const payload = (await req.json().catch(() => null)) as Payload | null;
  if (!payload) return new Response("ok");
  const event = (payload.event ?? "").toLowerCase().replace(/_/g, ".");

  after(async () => {
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
      if (!text && msg?.audioMessage) text = "[a pessoa mandou um áudio; peça para escrever]";
      if (!text.trim()) continue;
      if (k.id) await markRead(k.remoteJid, k.id).catch(() => {});
      try {
        await handleInbound({ phone, name: m.pushName, text: text.slice(0, 2000), extId: k.id });
      } catch (e) {
        await logActivity("sistema", `Erro ao responder ${phone}: ${(e as Error).message}`, phone);
      }
    }
    await maybeRunAgents(await getSettings()).catch(() => null);
  });
  return new Response("ok");
}
