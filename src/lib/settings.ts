import "server-only";
import { q } from "./db";
import { AGENTS, type AgentKey } from "./agents";
import { findNiche } from "./niches";
import { DEFAULT_TZ } from "./time";

export type Service = { name: string; minutes: number; price: number };
/** Expediente de um dia da semana (0 = domingo). Vazio = fechado. */
export type DayHours = { open: string; close: string } | null;
export type AgentConfig = { enabled: boolean; flow: string };

export type Settings = {
  /** false até alguém passar pela tela de configuração. */
  configured: boolean;
  niche: string;
  businessName: string;
  ownerName: string;
  /** WhatsApp do dono (só números, com DDI 55), recebe a página da manhã e os alertas. */
  ownerPhone: string;
  address: string;
  /** Informações extras que a recepção pode usar (formas de pagamento, estacionamento, convênios...). */
  about: string;
  timezone: string;
  hours: DayHours[];
  services: Service[];
  /** Quem ou onde atende ao mesmo tempo: "Cadeira 1", "Dra. Paula". */
  resources: string[];
  slotMinutes: number;
  returnDays: number;
  googleReviewUrl: string;
  /** Até quantas horas antes o cliente cancela pelo WhatsApp. */
  cancelHours: number;
  agents: Record<AgentKey, AgentConfig>;
};

const weekdays = (open: string, close: string, saturday: DayHours = { open: "08:00", close: "12:00" }): DayHours[] => [
  null,
  { open, close },
  { open, close },
  { open, close },
  { open, close },
  { open, close },
  saturday,
];

export function defaultSettings(nicheId = "barbearia"): Settings {
  const n = findNiche(nicheId);
  const unit = n.unit[0].toUpperCase() + n.unit.slice(1);
  return {
    configured: false,
    niche: n.id,
    businessName: "",
    ownerName: "",
    ownerPhone: "",
    address: "",
    about: "",
    timezone: DEFAULT_TZ,
    hours: weekdays("09:00", "18:00"),
    services: n.services.map((s) => ({ ...s })),
    resources: [`${unit} 1`, `${unit} 2`],
    slotMinutes: 30,
    returnDays: n.returnDays,
    googleReviewUrl: "",
    cancelHours: 2,
    agents: Object.fromEntries(AGENTS.map((a) => [a.key, { enabled: true, flow: a.flow.join("\n") }])) as Settings["agents"],
  };
}

/** Junta o que está salvo com os padrões (campos novos aparecem sem quebrar instalações antigas). */
function merge(saved: Partial<Settings>): Settings {
  const base = defaultSettings(saved.niche);
  const agents = { ...base.agents };
  for (const a of AGENTS) {
    const s = saved.agents?.[a.key];
    if (s) agents[a.key] = { enabled: s.enabled !== false, flow: typeof s.flow === "string" && s.flow.trim() ? s.flow : base.agents[a.key].flow };
  }
  return { ...base, ...saved, agents };
}

export async function getSettings(): Promise<Settings> {
  const rows = await q<{ data: Partial<Settings> }>("select data from settings where id = 1");
  return merge(rows[0]?.data ?? {});
}

export async function saveSettings(patch: Partial<Settings>) {
  const cur = await getSettings();
  const next = merge({ ...cur, ...patch });
  await q(
    "insert into settings (id, data, updated_at) values (1, $1, now()) on conflict (id) do update set data = excluded.data, updated_at = now()",
    [JSON.stringify(next)],
  );
  return next;
}

export const agentOn = (s: Settings, key: AgentKey) => s.agents[key]?.enabled !== false;
