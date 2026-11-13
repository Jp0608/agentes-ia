import "server-only";
import { createHash } from "crypto";
import { q } from "./db";
import type { AgentKey } from "./agents";

/**
 * WhatsApp pela Evolution API (um servidor à parte, no Railway, que mantém a sessão aberta).
 * Variáveis: EVOLUTION_API_URL, EVOLUTION_API_KEY e, opcional, EVOLUTION_INSTANCE.
 * Clientes simulados (modo demonstração) nunca recebem nada de verdade: a mensagem só fica no histórico.
 */
export const OWNER = "dono";

type Server = { url: string; key: string };

export function evoServer(): Server | null {
  const url = process.env.EVOLUTION_API_URL?.trim();
  const key = process.env.EVOLUTION_API_KEY?.trim();
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

export const instanceName = () => process.env.EVOLUTION_INSTANCE?.trim() || "agentes-ia";

/** Segredo do webhook: derivado do AUTH_SECRET para ninguém de fora mandar mensagens falsas. */
export const webhookKey = () => createHash("sha256").update(`webhook:${process.env.AUTH_SECRET ?? "dev"}`).digest("hex").slice(0, 32);

type EvoResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

async function evo<T = Record<string, unknown>>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown, timeoutMs = 20_000): Promise<EvoResult<T>> {
  const server = evoServer();
  if (!server) return { ok: false, status: 0, error: "A Evolution API ainda não foi configurada (EVOLUTION_API_URL e EVOLUTION_API_KEY)." };
  try {
    const res = await fetch(`${server.url}/${path}`, {
      method,
      headers: { apikey: server.key, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && !(data as { error?: unknown }).error) return { ok: true, data: data as T };
    if (res.status === 401 || res.status === 403) return { ok: false, status: res.status, error: "A chave da Evolution API está errada." };
    const r = (data as { response?: { message?: unknown }; message?: unknown }).response?.message ?? (data as { message?: unknown }).message;
    const msg = Array.isArray(r) ? r.join(" ") : typeof r === "string" ? r : "";
    return { ok: false, status: res.status, error: msg || `A Evolution API respondeu ${res.status}.` };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: (e as Error).name === "TimeoutError" ? "A Evolution API demorou para responder." : "Não consegui falar com a Evolution API. Confira o endereço.",
    };
  }
}

const EVENTS = ["MESSAGES_UPSERT", "CONNECTION_UPDATE"];

export async function connectWhatsApp(webhookUrl: string) {
  const name = instanceName();
  const state = await connectionState();
  if (state.ok && state.data === null) {
    const created = await evo<{ qrcode?: { base64?: string } }>(
      "POST",
      "instance/create",
      {
        instanceName: name,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        groupsIgnore: true,
        rejectCall: false,
        alwaysOnline: false,
        readMessages: false,
        syncFullHistory: false,
        webhook: { enabled: true, url: webhookUrl, byEvents: false, base64: false, events: EVENTS },
      },
      40_000,
    );
    if (!created.ok) return created;
    if (created.data.qrcode?.base64) return { ok: true as const, data: { qr: created.data.qrcode.base64, state: "connecting" } };
  } else if (!state.ok) {
    return state;
  } else {
    await evo("POST", `webhook/set/${encodeURIComponent(name)}`, { webhook: { enabled: true, url: webhookUrl, byEvents: false, base64: false, events: EVENTS } });
    if (state.data === "open") return { ok: true as const, data: { qr: null, state: "open" } };
  }
  const r = await evo<{ base64?: string }>("GET", `instance/connect/${encodeURIComponent(name)}`, undefined, 30_000);
  if (!r.ok) return r;
  return { ok: true as const, data: { qr: r.data.base64 ?? null, state: "connecting" } };
}

/** "open", "connecting", "close" ou null quando a instância ainda não existe. */
export async function connectionState(): Promise<EvoResult<string | null>> {
  const r = await evo<{ instance?: { state?: string } }>("GET", `instance/connectionState/${encodeURIComponent(instanceName())}`);
  if (r.ok) return { ok: true, data: r.data.instance?.state ?? null };
  if (r.status === 404 || /not exist|não existe/i.test(r.error)) return { ok: true, data: null };
  return r;
}

export async function instanceInfo() {
  const r = await evo<{ ownerJid?: string; profileName?: string }[]>("GET", `instance/fetchInstances?instanceName=${encodeURIComponent(instanceName())}`);
  return r.ok && Array.isArray(r.data) ? (r.data[0] ?? null) : null;
}

export async function disconnectWhatsApp() {
  await evo("DELETE", `instance/logout/${encodeURIComponent(instanceName())}`);
  return evo("DELETE", `instance/delete/${encodeURIComponent(instanceName())}`);
}

/** "5511999990000@s.whatsapp.net" → "5511999990000". */
export const jidDigits = (jid: string | null | undefined) => (jid ?? "").split("@")[0].split(":")[0].replace(/\D/g, "");

export async function logMessage(phone: string, direction: "in" | "out", body: string, agent?: AgentKey | "dono" | null, extId?: string) {
  const rows = await q<{ id: number }>(
    "insert into messages (phone, direction, body, agent, ext_id) values ($1, $2, $3, $4, $5) on conflict (ext_id) do nothing returning id",
    [phone, direction, body, agent ?? null, extId ?? null],
  );
  return rows.length > 0;
}

export async function logActivity(agent: AgentKey | "sistema", summary: string, phone?: string | null) {
  await q("insert into activity (agent, summary, phone) values ($1, $2, $3)", [agent, summary, phone ?? null]);
}

/**
 * Manda uma mensagem e guarda no histórico. Para cliente simulado ou sem WhatsApp conectado,
 * só guarda (aparece no simulador do painel).
 */
export async function send(phone: string, text: string, agent: AgentKey, opts: { simulated?: boolean } = {}) {
  await logMessage(phone, "out", text, agent);
  if (opts.simulated || phone === OWNER || !evoServer()) return { sent: false };
  const delay = Math.min(2500, 600 + text.length * 12);
  const r = await evo("POST", `message/sendText/${encodeURIComponent(instanceName())}`, { number: phone, text, delay, linkPreview: true }, 30_000);
  if (!r.ok) await logActivity("sistema", `Não consegui mandar mensagem para ${phone}: ${r.error}`, phone);
  return { sent: r.ok };
}

/** Mensagem para o dono (página da manhã e alertas). Sem número cadastrado, fica só no painel. */
export async function sendOwner(ownerPhone: string, text: string, agent: AgentKey) {
  const phone = ownerPhone ? ownerPhone : OWNER;
  return send(phone, text, agent, { simulated: !ownerPhone });
}

export async function markRead(remoteJid: string, id: string) {
  return evo("POST", `chat/markMessageAsRead/${encodeURIComponent(instanceName())}`, { readMessages: [{ id, fromMe: false, remoteJid }] });
}
