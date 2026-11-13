"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AGENTS, type AgentKey } from "@/lib/agents";
import { authenticate, createAccount, SignupError, updateAccountPassword, updateAccountProfile } from "@/lib/accounts";
import { createSession, endSession, failDelay, requireLogin, requireSession } from "@/lib/auth";
import { book, BookingError, getAppointment, normalizePhone, setStatus, upsertClient } from "@/lib/booking";
import { q } from "@/lib/db";
import { clearDemo, seedDemo } from "@/lib/demo";
import { markNoShow, offerFreedSlot, runAgents } from "@/lib/jobs";
import { findNiche } from "@/lib/niches";
import { createQuote, sendQuote } from "@/lib/quotes";
import { defaultSettings, getSettings, saveSettings, TONES, type DayHours, type Persona, type Service, type Tone } from "@/lib/settings";
import { tenantId } from "@/lib/tenant";
import { zoned } from "@/lib/time";
import { connectWhatsApp, disconnectWhatsApp, logActivity, webhookQuery } from "@/lib/whatsapp";

export type ActionState = { ok?: string; error?: string } | null;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/* ---------- Login, cadastro e conta ---------- */

export async function login(_: ActionState, f: FormData): Promise<ActionState> {
  const a = await authenticate(str(f, "email"), String(f.get("senha") ?? ""));
  if (!a) {
    await failDelay();
    return { error: "E-mail ou senha errados." };
  }
  await createSession({ tenantId: a.tenant_id, accountId: a.id });
  redirect("/painel");
}

export async function signup(_: ActionState, f: FormData): Promise<ActionState> {
  const password = String(f.get("senha") ?? "");
  if (password !== String(f.get("confirmar") ?? "")) return { error: "As senhas não são iguais." };
  let account: Awaited<ReturnType<typeof createAccount>>;
  try {
    account = await createAccount({ name: str(f, "businessName"), email: str(f, "email"), password });
  } catch (e) {
    if (e instanceof SignupError) {
      await failDelay();
      return { error: e.message };
    }
    throw e;
  }
  await createSession({ tenantId: account.tenant_id, accountId: account.id });
  redirect("/painel/configurar");
}

export async function logout() {
  await endSession();
  redirect("/entrar");
}

export async function saveAccount(_: ActionState, f: FormData): Promise<ActionState> {
  const { accountId } = await requireSession();
  try {
    await updateAccountProfile(accountId, { name: str(f, "name"), email: str(f, "email") });
  } catch (e) {
    if (e instanceof SignupError) return { error: e.message };
    throw e;
  }
  revalidatePath("/painel/conta");
  return { ok: "Dados salvos." };
}

export async function changePassword(_: ActionState, f: FormData): Promise<ActionState> {
  const { accountId } = await requireSession();
  const next = String(f.get("nova") ?? "");
  if (next !== String(f.get("confirmar") ?? "")) return { error: "As senhas novas não são iguais." };
  try {
    await updateAccountPassword(accountId, String(f.get("atual") ?? ""), next);
  } catch (e) {
    if (e instanceof SignupError) {
      await failDelay();
      return { error: e.message };
    }
    throw e;
  }
  return { ok: "Senha trocada." };
}

/* ---------- Configuração ---------- */

function parseServices(text: string): Service[] {
  return text
    .split("\n")
    .map((l) => l.split("|").map((x) => x.trim()))
    .filter((p) => p[0])
    .map(([name, minutes, price]) => ({
      name: name.slice(0, 60),
      minutes: Math.max(5, Math.min(600, Number(minutes) || 30)),
      price: Math.max(0, Number(String(price ?? "0").replace(/[^\d,.]/g, "").replace(",", ".")) || 0),
    }));
}

function readPersona(f: FormData, cur: Persona): Persona {
  if (!f.has("p_tone")) return cur;
  const pick = <T extends string>(v: string, allowed: readonly T[], fallback: T): T => ((allowed as readonly string[]).includes(v) ? (v as T) : fallback);
  return {
    assistantName: str(f, "p_assistantName").slice(0, 40),
    tone: pick(str(f, "p_tone"), Object.keys(TONES) as Tone[], cur.tone),
    treatment: pick(str(f, "p_treatment"), ["voce", "senhor"] as const, cur.treatment),
    emojis: pick(str(f, "p_emojis"), ["nenhum", "poucos", "varios"] as const, cur.emojis),
    length: pick(str(f, "p_length"), ["curta", "media"] as const, cur.length),
    proactive: f.get("p_proactive") === "on",
    greeting: str(f, "p_greeting").slice(0, 800),
    closing: str(f, "p_closing").slice(0, 400),
    afterHours: str(f, "p_afterHours").slice(0, 400),
    avoid: str(f, "p_avoid").slice(0, 400),
    extra: str(f, "p_extra").slice(0, 2000),
  };
}

export async function saveConfig(_: ActionState, f: FormData): Promise<ActionState> {
  await requireLogin();
  const cur = await getSettings();
  const niche = findNiche(str(f, "niche"));
  const nicheChanged = niche.id !== cur.niche;
  const hours: DayHours[] = Array.from({ length: 7 }, (_, i) => {
    if (f.get(`open-${i}`) !== "on") return null;
    const open = str(f, `from-${i}`) || "09:00";
    const close = str(f, `to-${i}`) || "18:00";
    return open < close ? { open, close } : null;
  });
  const services = parseServices(str(f, "services"));
  const resources = str(f, "resources").split("\n").map((r) => r.trim()).filter(Boolean).slice(0, 20);
  const base = nicheChanged && f.get("useNicheServices") === "on" ? defaultSettings(niche.id) : null;
  const businessName = str(f, "businessName");
  if (!businessName) return { error: "Coloque o nome do negócio." };
  await saveSettings({
    configured: true,
    niche: niche.id,
    businessName,
    ownerName: str(f, "ownerName"),
    ownerPhone: str(f, "ownerPhone") ? normalizePhone(str(f, "ownerPhone")) : "",
    address: str(f, "address"),
    about: str(f, "about").slice(0, 4000),
    googleReviewUrl: str(f, "googleReviewUrl"),
    hours,
    services: base ? base.services : services.length ? services : cur.services,
    resources: base ? base.resources : resources.length ? resources : cur.resources,
    returnDays: base ? base.returnDays : Math.max(1, Number(str(f, "returnDays")) || cur.returnDays),
    slotMinutes: [15, 20, 30, 60].includes(Number(str(f, "slotMinutes"))) ? Number(str(f, "slotMinutes")) : cur.slotMinutes,
    cancelHours: Math.max(0, Number(str(f, "cancelHours")) || 0),
    persona: readPersona(f, cur.persona),
  });
  revalidatePath("/painel", "layout");
  if (!cur.configured) redirect("/painel");
  return { ok: "Salvo." };
}

/* ---------- Agentes ---------- */

export async function toggleAgent(key: AgentKey, enabled: boolean) {
  await requireLogin();
  const s = await getSettings();
  await saveSettings({ agents: { ...s.agents, [key]: { ...s.agents[key], enabled } } });
  await logActivity("sistema", `${AGENTS.find((a) => a.key === key)?.name} ${enabled ? "ligado" : "desligado"}`);
  revalidatePath("/painel", "layout");
}

export async function saveFlow(key: AgentKey, flow: string) {
  await requireLogin();
  const s = await getSettings();
  const def = AGENTS.find((a) => a.key === key);
  const text = flow.trim() || def?.flow.join("\n") || "";
  await saveSettings({ agents: { ...s.agents, [key]: { ...s.agents[key], flow: text.slice(0, 4000) } } });
  revalidatePath("/painel/agentes");
  return { ok: "Fluxo salvo." };
}

export async function runNow(force: boolean) {
  await requireLogin();
  const s = await getSettings();
  const report = await runAgents(s, { force });
  revalidatePath("/painel", "layout");
  return report;
}

/* ---------- Agenda ---------- */

export async function newAppointment(_: ActionState, f: FormData): Promise<ActionState> {
  await requireLogin();
  const s = await getSettings();
  const phone = normalizePhone(str(f, "phone"));
  if (phone.length < 12) return { error: "Coloque o WhatsApp com DDD." };
  const day = str(f, "day");
  const time = str(f, "time");
  if (!day || !time) return { error: "Escolha o dia e a hora." };
  const c = await upsertClient(phone, str(f, "name"));
  try {
    const a = await book(s, { clientId: c.id, service: str(f, "service"), start: zoned(day, time, s.timezone), resource: str(f, "resource") || undefined, source: "painel" });
    await logActivity("sistema", `Horário marcado no painel: ${a.service} para ${c.name || c.phone}`, c.phone);
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  revalidatePath("/painel", "layout");
  return { ok: "Marcado." };
}

export async function setAppointment(id: number, status: "concluido" | "faltou" | "cancelado" | "confirmado") {
  await requireLogin();
  const s = await getSettings();
  if (status === "faltou") {
    await markNoShow(s, id);
  } else {
    const a = await getAppointment(id);
    await setStatus(id, status);
    if (status === "cancelado" && a) await offerFreedSlot(s, a);
  }
  revalidatePath("/painel", "layout");
}

/* ---------- Clientes ---------- */

export async function newClient(_: ActionState, f: FormData): Promise<ActionState> {
  await requireLogin();
  const phone = normalizePhone(str(f, "phone"));
  if (phone.length < 12) return { error: "Coloque o WhatsApp com DDD." };
  await upsertClient(phone, str(f, "name"));
  revalidatePath("/painel/clientes");
  return { ok: "Cliente salvo." };
}

export async function saveNotes(id: number, notes: string) {
  await requireLogin();
  await q("update clients set notes = $2 where id = $1 and tenant_id = $3", [id, notes.slice(0, 2000), await tenantId()]);
  revalidatePath("/painel/clientes");
}

/* ---------- Orçamentos ---------- */

export async function newQuote(_: ActionState, f: FormData): Promise<ActionState> {
  await requireLogin();
  const phone = normalizePhone(str(f, "phone"));
  if (phone.length < 12) return { error: "Coloque o WhatsApp com DDD." };
  const items = str(f, "items")
    .split("\n")
    .map((l) => l.split("|").map((x) => x.trim()))
    .filter((p) => p[0])
    .map(([name, price]) => ({ name: name.slice(0, 120), price: Number(String(price ?? "0").replace(/[^\d,.]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".")) || 0 }));
  if (!items.length) return { error: "Coloque pelo menos um item." };
  const title = str(f, "title") || items[0].name;
  const c = await upsertClient(phone, str(f, "name"));
  const id = await createQuote(c.id, title, items);
  if (f.get("sendNow") === "on") await sendQuote(await getSettings(), id);
  revalidatePath("/painel/orcamentos");
  return { ok: f.get("sendNow") === "on" ? "Orçamento enviado." : "Orçamento salvo." };
}

export async function sendQuoteNow(id: number) {
  await requireLogin();
  await sendQuote(await getSettings(), id);
  revalidatePath("/painel/orcamentos");
}

/* ---------- Demonstração ---------- */

export async function demoSeed() {
  await requireLogin();
  await seedDemo(await getSettings());
  revalidatePath("/painel", "layout");
}

export async function demoClear() {
  await requireLogin();
  await clearDemo();
  revalidatePath("/painel", "layout");
}

/* ---------- WhatsApp ---------- */

async function origin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
}

export async function whatsappConnect(phone?: string) {
  await requireLogin();
  const number = phone ? normalizePhone(phone) : "";
  if (phone && (number.length < 12 || number.length > 13)) return { error: "Confira o número: DDD + número, por exemplo (11) 99999-0000." };
  const url = `${await origin()}/api/whatsapp/webhook?${webhookQuery(await tenantId())}`;
  const r = await connectWhatsApp(url, number || undefined);
  if (!r.ok) return { error: r.error };
  if (number && !r.data.code && r.data.state !== "open") return { error: "Não consegui gerar o código agora. Tente de novo em alguns segundos." };
  return { qr: r.data.qr, code: r.data.code, state: r.data.state };
}

export async function whatsappDisconnect() {
  await requireLogin();
  await disconnectWhatsApp();
  revalidatePath("/painel/whatsapp");
}
