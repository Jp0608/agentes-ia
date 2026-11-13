import "server-only";
import { AsyncLocalStorage } from "async_hooks";
import { requireSession } from "./auth";

/**
 * Tenant (o negócio) da requisição atual. Toda consulta das libs filtra por ele.
 *
 * - Painel (páginas, server actions, /api/sim): vem do cookie de sessão.
 * - Webhook do WhatsApp, cron e tarefas em segundo plano (after): quem chama envolve o trabalho em
 *   withTenant(id, ...), que tem prioridade sobre o cookie.
 *
 * Sem nenhum dos dois, tenantId() manda para /entrar (nas páginas) ou dá erro: nunca cai num tenant padrão.
 */
const KEY = Symbol.for("agentes-ia.tenant");
const g = globalThis as unknown as Record<symbol, AsyncLocalStorage<number> | undefined>;
const store: AsyncLocalStorage<number> = (g[KEY] ??= new AsyncLocalStorage<number>());

export function withTenant<R>(tenantId: number, fn: () => Promise<R>): Promise<R> {
  if (!Number.isInteger(tenantId) || tenantId < 1) throw new Error("Tenant inválido.");
  return store.run(tenantId, fn);
}

export async function tenantId(): Promise<number> {
  const t = store.getStore();
  if (t !== undefined) return t;
  return (await requireSession()).tenantId;
}
