import "server-only";
import { createHash, timingSafeEqual } from "crypto";
import { q } from "./db";
import type { AgentKey } from "./agents";
import { tenantId } from "./tenant";

/**
 * WhatsApp pela Evolution API (um servidor à parte, no Railway, que mantém a sessão aberta).
 * Variáveis: EVOLUTION_API_URL, EVOLUTION_API_KEY e, opcional, EVOLUTION_INSTANCE.
 * Um servidor atende todos os negócios: cada tenant tem a própria instância. O tenant 1 (o de antes
 * das contas) continua com EVOLUTION_INSTANCE; os outros usam "t<id>" (t2, t3, ...).
 * Clientes simulados (modo demonstração) nunca recebem nada de verdade: a mensagem só fica no histórico.
 */
export const OWNER = "dono";

type Server = { url: string; key: string };

export function evoServer(): Server | null {
  const url = process.env.EVOLUTION_API_URL?.trim();
  const key = process.env.EVOLUTION_API_KEY?.trim();
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

const legacyInstance = () => process.env.EVOLUTION_INSTANCE?.trim() || "agentes-ia";

/** Instância da Evolution de um tenant. */
export const instanceOf = (tenant: number) => (tenant === 1 ? legacyInstance() : `t${tenant}`);

/** Instância da Evolution do tenant atual. */
export async function instanceName(): Promise<string> {
  return instanceOf(await tenantId());
}

/**
 * Segredo do webhook: derivado do AUTH_SECRET para ninguém de fora mandar mensagens falsas.
 * O tenant 1 mantém a chave antiga (sem número), para o webhook já cadastrado continuar valendo.
 */
export const webhookKey = (tenant = 1) =>
  createHash("sha256")
    .update(tenant === 1 ? `webhook:${process.env.AUTH_SECRET ?? "dev"}` : `webhook:${process.env.AUTH_SECRET ?? "dev"}:${tenant}`)
    .digest("hex")
    .slice(0, 32);

/** Parâmetros do endereço do webhook de um tenant. */
export const webhookQuery = (tenant: number) => (tenant === 1 ? `key=${webhookKey(1)}` : `t=${tenant}&key=${webhookKey(tenant)}`);

const sameKey = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Descobre o tenant de uma chamada do webhook. Com ?t=, a chave tem que ser a daquele tenant e, se a
 * Evolution mandou o nome da instância, ele tem que ser o daquele tenant. Com a chave antiga (sem ?t=)
 * é o tenant 1. Devolve null quando a chamada não vale.
 */
export function webhookTenant(params: URLSearchParams, instance: string | undefined): number | null {
  const key = params.get("key") ?? "";
  const t = params.get("t");
  if (t === null) return sameKey(key, webhookKey(1)) ? 1 : null;
  const id = Number(t);
  if (!Number.isInteger(id) || id < 2 || !sameKey(key, webhookKey(id))) return null;
  if (instance && instance !== instanceOf(id)) return null;
  return id;
}

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

/**
 * Conecta o WhatsApp. Sem `number`, devolve o QR code. Com `number` (só dígitos, com DDI 55), devolve
 * também o código de 8 letras para digitar no celular (WhatsApp → Aparelhos conectados → Conectar com número).
 */
export async function connectWhatsApp(webhookUrl: string, number?: string) {
  const name = await instanceName();
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
    if (!number && created.data.qrcode?.base64) return { ok: true as const, data: { qr: created.data.qrcode.base64, code: null, state: "connecting" } };
  } else if (!state.ok) {
    return state;
  } else {
    await evo("POST", `webhook/set/${encodeURIComponent(name)}`, { webhook: { enabled: true, url: webhookUrl, byEvents: false, base64: false, events: EVENTS } });
    if (state.data === "open") return { ok: true as const, data: { qr: null, code: null, state: "open" } };
  }
  const query = number ? `?number=${encodeURIComponent(number)}` : "";
  const r = await evo<{ base64?: string; pairingCode?: string | null }>("GET", `instance/connect/${encodeURIComponent(name)}${query}`, undefined, 30_000);
  if (!r.ok) return r;
  const code = r.data.pairingCode ? String(r.data.pairingCode).replace(/[^A-Za-z0-9]/g, "").toUpperCase() : null;
  return { ok: true as const, data: { qr: r.data.base64 ?? null, code, state: "connecting" } };
}

/** "open", "connecting", "close" ou null quando a instância ainda não existe. */
export async function connectionState(): Promise<EvoResult<string | null>> {
  const name = await instanceName();
  const r = await evo<{ instance?: { state?: string } }>("GET", `instance/connectionState/${encodeURIComponent(name)}`);
  if (r.ok) return { ok: true, data: r.data.instance?.state ?? null };
  if (r.status === 404 || /not exist|não existe/i.test(r.error)) return { ok: true, data: null };
  return r;
}

export async function instanceInfo() {
  const name = await instanceName();
  const r = await evo<{ ownerJid?: string; profileName?: string }[]>("GET", `instance/fetchInstances?instanceName=${encodeURIComponent(name)}`);
  return r.ok && Array.isArray(r.data) ? (r.data[0] ?? null) : null;
}

export async function disconnectWhatsApp() {
  const name = await instanceName();
  await evo("DELETE", `instance/logout/${encodeURIComponent(name)}`);
  return evo("DELETE", `instance/delete/${encodeURIComponent(name)}`);
}

/** "5511999990000@s.whatsapp.net" → "5511999990000". */
export const jidDigits = (jid: string | null | undefined) => (jid ?? "").split("@")[0].split(":")[0].replace(/\D/g, "");

export async function logMessage(phone: string, direction: "in" | "out", body: string, agent?: AgentKey | "dono" | null, extId?: string) {
  const rows = await q<{ id: number }>(
    `insert into messages (tenant_id, phone, direction, body, agent, ext_id) values ($1, $2, $3, $4, $5, $6)
     on conflict (tenant_id, ext_id) do nothing returning id`,
    [await tenantId(), phone, direction, body, agent ?? null, extId ?? null],
  );
  return rows.length > 0;
}

export async function logActivity(agent: AgentKey | "sistema", summary: string, phone?: string | null) {
  await q("insert into activity (tenant_id, agent, summary, phone) values ($1, $2, $3, $4)", [await tenantId(), agent, summary, phone ?? null]);
}

/**
 * Manda uma mensagem e guarda no histórico. Para cliente simulado ou sem WhatsApp conectado,
 * só guarda (aparece no simulador do painel).
 */
export async function send(phone: string, text: string, agent: AgentKey, opts: { simulated?: boolean } = {}) {
  await logMessage(phone, "out", text, agent);
  if (opts.simulated || phone === OWNER || !evoServer()) return { sent: false };
  const name = await instanceName();
  const delay = Math.min(2500, 600 + text.length * 12);
  const r = await evo("POST", `message/sendText/${encodeURIComponent(name)}`, { number: phone, text, delay, linkPreview: true }, 30_000);
  if (!r.ok) {
    const why = r.status === 404 ? "o WhatsApp deste negócio não está conectado" : r.error;
    await logActivity("sistema", `Não consegui mandar mensagem para ${phone}: ${why}`, phone);
  }
  return { sent: r.ok };
}

/** Mensagem para o dono (página da manhã e alertas). Sem número cadastrado, fica só no painel. */
export async function sendOwner(ownerPhone: string, text: string, agent: AgentKey) {
  const phone = ownerPhone ? ownerPhone : OWNER;
  return send(phone, text, agent, { simulated: !ownerPhone });
}

export async function markRead(remoteJid: string, id: string) {
  const name = await instanceName();
  return evo("POST", `chat/markMessageAsRead/${encodeURIComponent(name)}`, { readMessages: [{ id, fromMe: false, remoteJid }] });
}

// ---- Áudios recebidos (ver lib/audio.ts) ----
export type EvoServer = Server;

/**
 * Baixa a mídia de uma mensagem recebida (áudio, por exemplo) em base64.
 * Recebe servidor, instância e a `key` da mensagem explicitamente. Devolve null se não deu.
 */
export async function fetchMediaBase64(server: EvoServer, instance: string, key: unknown, timeoutMs = 15_000) {
  try {
    const res = await fetch(`${server.url}/chat/getBase64FromMediaMessage/${encodeURIComponent(instance)}`, {
      method: "POST",
      headers: { apikey: server.key, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { key }, convertToMp4: false }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as { base64?: string; mimetype?: string } | null;
    return data?.base64 ? { base64: data.base64, mimetype: data.mimetype ?? "" } : null;
  } catch {
    return null;
  }
}
