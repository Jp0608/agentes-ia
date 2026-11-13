import { q } from "@/lib/db";
import { runAgents } from "@/lib/jobs";
import { allTenantIds, getSettings } from "@/lib/settings";
import { withTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Roda os agentes automáticos de todos os negócios, um de cada vez. Chamado a cada 10 minutos pelo
 * GitHub Actions (.github/workflows/agentes.yml) ou por qualquer agendador, com o cabeçalho
 * Authorization: Bearer CRON_SECRET (ou ?key=CRON_SECRET).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? new URL(req.url).searchParams.get("key");
  if (!secret || given !== secret) return Response.json({ error: "não autorizado" }, { status: 401 });
  const out: Record<string, unknown> = {};
  for (const t of await allTenantIds()) {
    out[t] = await withTenant(t, async () => {
      const s = await getSettings();
      if (!s.configured) return { skipped: "não configurado" };
      await q(
        "insert into job_runs (tenant_id, key, ran_at) values ($1, 'tick', now()) on conflict (tenant_id, key) do update set ran_at = now()",
        [t],
      );
      return runAgents(s);
    }).catch((e: unknown) => ({ error: (e as Error).message }));
  }
  return Response.json(out);
}
