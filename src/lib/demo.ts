import "server-only";
import { q } from "./db";
import { book, upsertClient } from "./booking";
import type { Settings } from "./settings";
import { addDays, dayKey, minutesOf, weekdayOf, zoned } from "./time";
import { logActivity } from "./whatsapp";

/**
 * Dados de demonstração: clientes simulados com histórico, para os agentes terem o que fazer
 * na hora de mostrar o sistema (gente na hora de voltar, atendimento de ontem para avaliar,
 * horários de amanhã para lembrar). Nenhum desses números recebe mensagem de verdade.
 */
const NAMES = [
  "Camila Rocha", "Rafael Duarte", "Bianca Lima", "Thiago Alves", "Marcos Vieira",
  "Ana Beatriz", "Pedro Santos", "Lia Tavares", "Jonas Pereira", "Priscila Alves",
];

const simPhone = (i: number) => `550000000${String(100 + i).padStart(4, "0")}`;

/** Primeiro horário de abertura num dia útil, a partir de `day` indo para trás ou para frente. */
function openDay(s: Settings, day: string, step: 1 | -1) {
  let d = day;
  for (let i = 0; i < 10 && !s.hours[weekdayOf(d)]; i++) d = addDays(d, step);
  return d;
}

export async function seedDemo(s: Settings, now = new Date()) {
  const tz = s.timezone;
  const today = dayKey(now, tz);
  const svc = (i: number) => s.services[i % s.services.length].name;
  const clients: Awaited<ReturnType<typeof upsertClient>>[] = [];
  for (let i = 0; i < NAMES.length; i++) clients.push(await upsertClient(simPhone(i), NAMES[i], true));

  const at = async (ci: number, day: string, hhmm: string, si: number, status?: string) => {
    const hours = s.hours[weekdayOf(day)];
    if (!hours) return;
    const m = Math.max(minutesOf(hours.open), Math.min(minutesOf(hhmm), minutesOf(hours.close) - 60));
    const start = zoned(day, `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`, tz);
    try {
      const a = await book(s, { clientId: clients[ci].id, service: svc(si), start, source: "demo" });
      if (status) await q("update appointments set status = $2 where id = $1", [a.id, status]);
    } catch {
      /* horário ocupado: ignora */
    }
  };

  // Passaram da hora de voltar: atendidos há mais tempo que o retorno.
  const old = openDay(s, addDays(today, -(s.returnDays + 5)), -1);
  await at(0, old, "10:00", 1, "concluido");
  await at(1, openDay(s, addDays(old, -3), -1), "15:00", 0, "concluido");
  await at(2, openDay(s, addDays(old, -8), -1), "11:00", 2, "concluido");
  // Atendidos ontem: vão receber o pedido de avaliação.
  const yesterday = openDay(s, addDays(today, -1), -1);
  await at(3, yesterday, "09:00", 0, "concluido");
  await at(4, yesterday, "14:00", 1, "concluido");
  // Falta de ontem (entra no "perdido").
  await at(5, yesterday, "16:00", 2, "faltou");
  // Amanhã: vão receber lembrete.
  const tomorrow = openDay(s, addDays(today, 1), 1);
  await at(6, tomorrow, "09:30", 0);
  await at(7, tomorrow, "11:00", 1);
  // Hoje.
  await at(8, today, "16:00", 0);
  // Lista de espera.
  await q("insert into waitlist (client_id, service, wants) values ($1, $2, 'qualquer horário de manhã')", [clients[9].id, svc(0)]);
  // Orçamento esperando resposta, enviado há 4 dias.
  const total = s.services.slice(0, 2).reduce((a, x) => a + x.price, 0);
  await q(
    `insert into quotes (client_id, title, items, total, explanation, status, sent_at)
     values ($1, $2, $3, $4, '', 'enviado', $5)`,
    [clients[1].id, s.services[0].name, JSON.stringify(s.services.slice(0, 2).map((x) => ({ name: x.name, price: x.price }))), total, new Date(now.getTime() - 4 * 86400_000)],
  );
  await logActivity("sistema", "Dados de demonstração criados: 10 clientes simulados");
}

export async function clearDemo() {
  await q("delete from messages where phone in (select phone from clients where simulated)");
  await q("delete from messages where phone = 'dono'");
  await q("delete from clients where simulated");
  await q("delete from activity");
  await q("delete from job_runs");
}

export const SIM_ME = "5500000009999";
