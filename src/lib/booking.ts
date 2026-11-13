import "server-only";
import { q, tx, type Q } from "./db";
import type { Service, Settings } from "./settings";
import { addDays, dayKey, minutesOf, parts, weekdayOf, zoned } from "./time";

export type Client = {
  id: number;
  phone: string;
  name: string;
  notes: string;
  simulated: boolean;
  opt_out: boolean;
  last_return_at: Date | null;
  created_at: Date;
};

export type Appointment = {
  id: number;
  client_id: number;
  service: string;
  price: number;
  resource: string;
  starts_at: Date;
  ends_at: Date;
  status: "marcado" | "confirmado" | "concluido" | "faltou" | "cancelado";
  source: string;
  reminder_sent_at: Date | null;
  confirmed_at: Date | null;
  review_asked_at: Date | null;
  review_score: number | null;
  review_text: string | null;
  created_at: Date;
};

export type AppointmentWithClient = Appointment & { client_name: string; client_phone: string; client_simulated: boolean };

/** Status que ocupam a agenda. */
export const BUSY = ["marcado", "confirmado", "concluido"];

const fixAppt = <T extends Appointment>(a: T): T => ({
  ...a,
  id: Number(a.id),
  client_id: Number(a.client_id),
  price: Number(a.price),
  starts_at: new Date(a.starts_at),
  ends_at: new Date(a.ends_at),
});

export const onlyDigits = (s: string) => s.replace(/\D/g, "");

/** Telefone no formato do WhatsApp: 55 + DDD + número. */
export function normalizePhone(raw: string) {
  const d = onlyDigits(raw);
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

export async function findClientByPhone(phone: string, db: Q = q) {
  const rows = await db<Client>("select * from clients where phone = $1", [phone]);
  return rows[0] ? { ...rows[0], id: Number(rows[0].id) } : null;
}

export async function getClient(id: number) {
  const rows = await q<Client>("select * from clients where id = $1", [id]);
  return rows[0] ? { ...rows[0], id: Number(rows[0].id) } : null;
}

export async function upsertClient(phone: string, name?: string, simulated = false, db: Q = q): Promise<Client> {
  const rows = await db<Client>(
    `insert into clients (phone, name, simulated) values ($1, $2, $3)
     on conflict (phone) do update set name = case when coalesce($2, '') <> '' then $2 else clients.name end
     returning *`,
    [phone, name?.trim() ?? "", simulated],
  );
  return { ...rows[0], id: Number(rows[0].id) };
}

export const findService = (s: Settings, name: string): Service | undefined => {
  const n = name.trim().toLowerCase();
  return s.services.find((x) => x.name.toLowerCase() === n) ?? s.services.find((x) => x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase()));
};

async function busyBetween(from: Date, to: Date, db: Q = q, exceptId?: number) {
  const rows = await db<Appointment>(
    `select * from appointments where status = any($1) and starts_at < $3 and ends_at > $2 ${exceptId ? "and id <> $4" : ""}`,
    exceptId ? [BUSY, from, to, exceptId] : [BUSY, from, to],
  );
  return rows.map(fixAppt);
}

export type Slot = { start: Date; resource: string };

/**
 * Horários livres de um serviço num dia: anda de slotMinutes em slotMinutes dentro do expediente
 * e devolve, para cada início, o primeiro recurso (cadeira, sala, profissional) livre.
 */
export async function freeSlots(s: Settings, serviceName: string, day: string, opts: { now?: Date; resource?: string; exceptId?: number } = {}) {
  const service = findService(s, serviceName);
  if (!service) return [];
  const hours = s.hours[weekdayOf(day)];
  if (!hours) return [];
  const now = opts.now ?? new Date();
  const open = minutesOf(hours.open);
  const close = minutesOf(hours.close);
  const dayStart = zoned(day, hours.open, s.timezone);
  const dayEnd = zoned(day, hours.close, s.timezone);
  const busy = await busyBetween(dayStart, dayEnd, q, opts.exceptId);
  const resources = opts.resource ? s.resources.filter((r) => r === opts.resource) : s.resources;
  const out: Slot[] = [];
  for (let m = open; m + service.minutes <= close; m += s.slotMinutes) {
    const start = new Date(dayStart.getTime() + (m - open) * 60000);
    if (start.getTime() < now.getTime() + 30 * 60000) continue;
    const end = new Date(start.getTime() + service.minutes * 60000);
    const free = resources.find((r) => !busy.some((b) => b.resource === r && b.starts_at < end && b.ends_at > start));
    if (free) out.push({ start, resource: free });
  }
  return out;
}

/** Próximos dias com horário livre, a partir de hoje. */
export async function nextFreeSlots(s: Settings, serviceName: string, opts: { fromDay?: string; days?: number; limit?: number; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  let day = opts.fromDay ?? dayKey(now, s.timezone);
  const out: Slot[] = [];
  for (let i = 0; i < (opts.days ?? 14) && out.length < (opts.limit ?? 3); i++, day = addDays(day, 1)) {
    const slots = await freeSlots(s, serviceName, day, { now });
    // Espalha as opções no dia: manhã e tarde em vez de três horários colados.
    const picked = slots.filter((_, j) => j % Math.max(1, Math.floor(slots.length / 2)) === 0).slice(0, 2);
    out.push(...picked);
  }
  return out.slice(0, opts.limit ?? 3);
}

export class BookingError extends Error {}

/** Marca um horário. Trava a agenda durante a gravação para ninguém pegar o mesmo horário ao mesmo tempo. */
export async function book(
  s: Settings,
  input: { clientId: number; service: string; start: Date; resource?: string; source: string; exceptId?: number },
) {
  const service = findService(s, input.service);
  if (!service) throw new BookingError(`Serviço "${input.service}" não existe.`);
  const start = input.start;
  const end = new Date(start.getTime() + service.minutes * 60000);
  const p = parts(start, s.timezone);
  const hours = s.hours[p.wd];
  const startMin = p.h * 60 + p.min;
  if (!hours || startMin < minutesOf(hours.open) || startMin + service.minutes > minutesOf(hours.close)) {
    throw new BookingError("Esse horário está fora do expediente.");
  }
  return tx(async (t) => {
    await t("select pg_advisory_xact_lock(4242)");
    const busy = await busyBetween(start, end, t, input.exceptId);
    const resources = input.resource ? [input.resource] : s.resources;
    const free = resources.find((r) => !busy.some((b) => b.resource === r));
    if (!free) throw new BookingError("Esse horário acabou de ser ocupado.");
    if (input.exceptId) {
      const rows = await t<Appointment>(
        `update appointments set service = $2, price = $3, resource = $4, starts_at = $5, ends_at = $6, status = 'marcado',
           reminder_sent_at = null, confirmed_at = null where id = $1 returning *`,
        [input.exceptId, service.name, service.price, free, start, end],
      );
      return fixAppt(rows[0]);
    }
    const rows = await t<Appointment>(
      `insert into appointments (client_id, service, price, resource, starts_at, ends_at, source)
       values ($1, $2, $3, $4, $5, $6, $7) returning *`,
      [input.clientId, service.name, service.price, free, start, end, input.source],
    );
    return fixAppt(rows[0]);
  });
}

export async function getAppointment(id: number) {
  const rows = await q<AppointmentWithClient>(
    `select a.*, c.name as client_name, c.phone as client_phone, c.simulated as client_simulated
     from appointments a join clients c on c.id = a.client_id where a.id = $1`,
    [id],
  );
  return rows[0] ? fixAppt(rows[0]) : null;
}

export async function setStatus(id: number, status: Appointment["status"]) {
  const rows = await q<Appointment>(
    `update appointments set status = $2, confirmed_at = case when $2 = 'confirmado' then now() else confirmed_at end
     where id = $1 returning *`,
    [id, status],
  );
  return rows[0] ? fixAppt(rows[0]) : null;
}

export async function appointmentsBetween(from: Date, to: Date) {
  const rows = await q<AppointmentWithClient>(
    `select a.*, c.name as client_name, c.phone as client_phone, c.simulated as client_simulated
     from appointments a join clients c on c.id = a.client_id
     where a.starts_at >= $1 and a.starts_at < $2 order by a.starts_at`,
    [from, to],
  );
  return rows.map(fixAppt);
}

/** Próximos horários do cliente (para remarcar e cancelar pelo WhatsApp). */
export async function upcomingOf(clientId: number, now = new Date()) {
  const rows = await q<Appointment>(
    "select * from appointments where client_id = $1 and starts_at > $2 and status in ('marcado','confirmado') order by starts_at",
    [clientId, now],
  );
  return rows.map(fixAppt);
}

export async function historyOf(clientId: number, limit = 5) {
  const rows = await q<Appointment>("select * from appointments where client_id = $1 order by starts_at desc limit $2", [clientId, limit]);
  return rows.map(fixAppt);
}

export { fixAppt };
