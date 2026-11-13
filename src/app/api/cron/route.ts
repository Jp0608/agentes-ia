import { runAgents } from "@/lib/jobs";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Roda os agentes automáticos. Chamado a cada 10 minutos pelo GitHub Actions (.github/workflows/agentes.yml)
 * ou por qualquer agendador, com o cabeçalho Authorization: Bearer CRON_SECRET (ou ?key=CRON_SECRET).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? new URL(req.url).searchParams.get("key");
  if (!secret || given !== secret) return Response.json({ error: "não autorizado" }, { status: 401 });
  const s = await getSettings();
  if (!s.configured) return Response.json({ skipped: "não configurado" });
  return Response.json(await runAgents(s));
}
