/**
 * Datas no fuso do negócio. Tudo é guardado em UTC; aqui fica a conversão para o horário local
 * (padrão America/Sao_Paulo) sem depender do fuso do servidor.
 */
export const DEFAULT_TZ = "America/Sao_Paulo";

type Parts = { y: number; m: number; d: number; h: number; min: number; wd: number };

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Partes da data no fuso local. */
export function parts(date: Date, tz = DEFAULT_TZ): Parts {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
  }).formatToParts(date);
  const g = (t: string) => f.find((p) => p.type === t)?.value ?? "0";
  return { y: +g("year"), m: +g("month"), d: +g("day"), h: +g("hour") % 24, min: +g("minute"), wd: WD[g("weekday")] ?? 0 };
}

/** Diferença do fuso em minutos naquele instante (São Paulo: -180). */
function offsetMinutes(date: Date, tz: string) {
  const p = parts(date, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
  return Math.round((asUtc - Math.floor(date.getTime() / 60000) * 60000) / 60000);
}

/** "2026-11-14" + "09:30" no fuso local → instante UTC. */
export function zoned(day: string, hhmm: string, tz = DEFAULT_TZ): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, h, min));
  const off = offsetMinutes(guess, tz);
  const first = new Date(guess.getTime() - off * 60000);
  const off2 = offsetMinutes(first, tz);
  return off2 === off ? first : new Date(guess.getTime() - off2 * 60000);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11-14" do dia local. */
export function dayKey(date: Date, tz = DEFAULT_TZ) {
  const p = parts(date, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function addDays(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function weekdayOf(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "9h30", "14h". */
export function hourLabel(date: Date, tz = DEFAULT_TZ) {
  const p = parts(date, tz);
  return p.min ? `${p.h}h${pad(p.min)}` : `${p.h}h`;
}

/** "hoje", "amanhã", "sexta (21/11)". */
export function dayLabel(date: Date, tz = DEFAULT_TZ, now = new Date()) {
  const k = dayKey(date, tz);
  const today = dayKey(now, tz);
  if (k === today) return "hoje";
  if (k === addDays(today, 1)) return "amanhã";
  const p = parts(date, tz);
  return `${WEEKDAYS[p.wd]} (${pad(p.d)}/${pad(p.m)})`;
}

/** "amanhã às 9h30". */
export const whenLabel = (date: Date, tz = DEFAULT_TZ, now = new Date()) => `${dayLabel(date, tz, now)} às ${hourLabel(date, tz)}`;

export const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};
export const hhmmOf = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

export const brl = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Primeiro nome, mantendo o título: "Dra. Paula Souza" → "Dra. Paula", "Carlos Lima" → "Carlos". */
export function shortName(name: string) {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "";
  const title = /^(dr|dra|sr|sra|seu|dona|prof|profa)\.?$/i.test(w[0]);
  return title && w[1] ? `${w[0]} ${w[1]}` : w[0];
}

/** "13/11" */
export const shortDate = (date: Date, tz = DEFAULT_TZ) => {
  const p = parts(date, tz);
  return `${pad(p.d)}/${pad(p.m)}`;
};
