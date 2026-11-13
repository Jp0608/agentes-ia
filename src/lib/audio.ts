import "server-only";
import { evoServer, fetchMediaBase64, instanceName, type EvoServer } from "./whatsapp";

/**
 * Áudios do WhatsApp (mensagem de voz e arquivo de áudio) viram texto pelo Vercel AI Gateway.
 *
 * Dois caminhos, escolhidos pelo modelo em TRANSCRIBE_MODEL:
 * - Modelo de transcrição (whisper, *-transcribe, scribe, stt): endpoint próprio do gateway,
 *   POST /v4/ai/transcription-model, com o áudio em base64 no JSON.
 * - Modelo de conversa que entende áudio (padrão: google/gemini-3.8-flash): /v1/chat/completions
 *   com o áudio como arquivo. É o caminho do plano grátis, que não inclui modelos de transcrição.
 * Se o modelo de transcrição falhar (por exemplo, sem créditos pagos), tenta o de conversa
 * (TRANSCRIBE_FALLBACK_MODEL) antes de desistir.
 */
const GATEWAY_URL = "https://ai-gateway.vercel.sh";
const DEFAULT_MODEL = "google/gemini-3.8-flash";
const MAX_BYTES = 15 * 1024 * 1024; // áudio de WhatsApp tem uns 100 KB por minuto; isso é muito mais do que precisa
const TIMEOUT_MS = 20_000;
const INAUDIVEL = "[inaudivel]";

/** O que fica no histórico (e é o que a recepção lê como fala do cliente). */
export const audioBody = (transcript: string | null) => (transcript ? `🎤 (áudio) ${transcript}` : "🎤 (áudio não entendido)");

/** Mesmo token que a recepção usa: chave própria ou o OIDC da Vercel (cópia de brain.ts para não mexer lá). */
function gatewayToken(): string | undefined {
  const key = process.env.AI_GATEWAY_API_KEY?.trim();
  if (key) return key;
  try {
    const ctx = (globalThis as Record<symbol, { get?: () => { headers?: Record<string, string> } } | undefined>)[
      Symbol.for("@vercel/request-context")
    ]?.get?.();
    const fromHeader = ctx?.headers?.["x-vercel-oidc-token"];
    if (fromHeader) return fromHeader;
  } catch {
    // sem contexto de requisição
  }
  return process.env.VERCEL_OIDC_TOKEN?.trim() || undefined;
}

const isTranscriptionModel = (model: string) => /whisper|transcribe|scribe|stt/i.test(model);

/** "audio/ogg; codecs=opus" → "audio/ogg". */
const baseMime = (mime: string) => (mime.split(";")[0].trim().toLowerCase() || "audio/ogg");

const EXT: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/amr": "amr",
};

/** Limpa a resposta do modelo; devolve null quando não deu para entender a fala. */
function clean(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const t = text
    .trim()
    .replace(/^["“]|["”]$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t.toLowerCase().includes(INAUDIVEL)) return null;
  return t.slice(0, 2000);
}

async function viaTranscriptionModel(buf: Buffer, mime: string, model: string, token: string, signal: AbortSignal) {
  const res = await fetch(`${GATEWAY_URL}/v4/ai/transcription-model`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "ai-gateway-protocol-version": "0.0.1",
      "ai-transcription-model-specification-version": "4",
      "ai-model-id": model,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ audio: buf.toString("base64"), mediaType: mime }),
    signal,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { text?: string; error?: { message?: string } | string };
  if (!res.ok) throw new Error(`transcrição ${res.status}: ${typeof data.error === "string" ? data.error : (data.error?.message ?? "")}`);
  return clean(data.text);
}

async function viaChatModel(buf: Buffer, mime: string, model: string, token: string, signal: AbortSignal) {
  const ext = EXT[mime] ?? "ogg";
  const res = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content:
            "Você transcreve mensagens de voz do WhatsApp enviadas por clientes de um pequeno negócio no Brasil. " +
            "Escreva exatamente o que a pessoa fala, em português do Brasil, com pontuação normal. " +
            "Responda só com a transcrição: sem aspas, sem comentários, sem resumir e sem responder ao pedido. " +
            `Se não houver fala que dê para entender, responda apenas ${INAUDIVEL}.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcreva este áudio." },
            { type: "file", file: { filename: `audio.${ext}`, file_data: `data:${mime};base64,${buf.toString("base64")}` } },
          ],
        },
      ],
    }),
    signal,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string | { type?: string; text?: string }[] } }[];
    error?: { message?: string } | string;
  };
  if (!res.ok) throw new Error(`chat ${res.status}: ${typeof data.error === "string" ? data.error : (data.error?.message ?? "")}`);
  const content = data.choices?.[0]?.message?.content;
  return clean(Array.isArray(content) ? content.map((p) => p.text ?? "").join("") : content);
}

/**
 * Transcreve o áudio. Devolve null quando não conseguiu (sem token, erro, demora ou fala inaudível).
 * `opts` permite passar token e modelo explicitamente (útil por cliente/instância); sem isso, lê o ambiente.
 */
export async function transcribeAudio(
  buf: Buffer,
  mime: string,
  opts: { token?: string; model?: string; fallbackModel?: string; timeoutMs?: number } = {},
): Promise<string | null> {
  if (!buf.length || buf.length > MAX_BYTES) return null;
  const token = opts.token ?? gatewayToken();
  if (!token) return null;
  const type = baseMime(mime);
  const model = opts.model ?? (process.env.TRANSCRIBE_MODEL?.trim() || DEFAULT_MODEL);
  const fallback = opts.fallbackModel ?? (process.env.TRANSCRIBE_FALLBACK_MODEL?.trim() || DEFAULT_MODEL);
  // Um só prazo para as duas tentativas: a função da Vercel tem 60 s no total.
  const signal = AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS);
  try {
    if (!isTranscriptionModel(model)) return await viaChatModel(buf, type, model, token, signal);
    try {
      return await viaTranscriptionModel(buf, type, model, token, signal);
    } catch (e) {
      if (signal.aborted || fallback === model || isTranscriptionModel(fallback)) throw e;
      console.warn(`[audio] ${(e as Error).message}; tentando ${fallback}`);
      return await viaChatModel(buf, type, fallback, token, signal);
    }
  } catch (e) {
    console.warn(`[audio] não consegui transcrever: ${(e as Error).message}`);
    return null;
  }
}

type AudioInfo = { mimetype?: string; seconds?: number; fileLength?: number | string };
type AudioMsg = { audioMessage?: AudioInfo; pttMessage?: AudioInfo; base64?: string };

/** A mensagem é um áudio (mensagem de voz ou arquivo de áudio)? */
export const audioOf = (message: unknown): AudioInfo | null => {
  const m = message as AudioMsg | null | undefined;
  return m?.audioMessage ?? m?.pttMessage ?? null;
};

/**
 * Áudio que chegou pelo webhook → texto para o histórico. Usa o base64 do próprio webhook
 * (quando a instância manda "webhook base64") ou baixa pela Evolution API.
 * Servidor e instância vêm explícitos em `evo`; sem isso, usa os do ambiente (EVOLUTION_*).
 */
export async function voiceNoteText(
  m: { key?: unknown; message?: unknown },
  evo: { server: EvoServer | null; instance: string } = { server: evoServer(), instance: instanceName() },
  opts: Parameters<typeof transcribeAudio>[2] = {},
): Promise<string> {
  const info = audioOf(m.message);
  if (!info) return "";
  try {
    let b64 = (m.message as AudioMsg).base64 ?? null;
    let mime = info.mimetype ?? "audio/ogg";
    if (!b64 && evo.server && m.key) {
      const media = await fetchMediaBase64(evo.server, evo.instance, m.key, 15_000);
      b64 = media?.base64 ?? null;
      mime = media?.mimetype || mime;
    }
    if (!b64) return audioBody(null);
    const buf = Buffer.from(b64.replace(/^data:[^,]*,/, ""), "base64");
    return audioBody(await transcribeAudio(buf, mime, opts));
  } catch (e) {
    console.warn(`[audio] ${(e as Error).message}`);
    return audioBody(null);
  }
}
