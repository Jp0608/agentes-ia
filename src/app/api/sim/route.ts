import { getSession } from "@/lib/auth";
import { q } from "@/lib/db";
import { SIM_ME } from "@/lib/demo";
import { handleInbound } from "@/lib/inbound";
import { getSettings } from "@/lib/settings";
import { withTenant } from "@/lib/tenant";
import { OWNER } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Msg = { id: number; direction: string; body: string; agent: string | null; created_at: string };

/** Simulador: conversa de um cliente simulado e caixa do WhatsApp do dono. */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "faça login" }, { status: 401 });
  const t = session.tenantId;
  const phone = new URL(req.url).searchParams.get("phone") || SIM_ME;
  const s = await withTenant(t, () => getSettings());
  const ownerPhone = s.ownerPhone || OWNER;
  const [chat, owner, clients] = await Promise.all([
    q<Msg>("select id, direction, body, agent, created_at from messages where tenant_id = $2 and phone = $1 order by created_at, id limit 300", [phone, t]),
    q<Msg>(
      "select id, direction, body, agent, created_at from messages where tenant_id = $2 and phone = $1 and direction = 'out' order by created_at desc, id desc limit 30",
      [ownerPhone, t],
    ),
    q<{ phone: string; name: string }>("select phone, name from clients where tenant_id = $1 and simulated order by name", [t]),
  ]);
  return Response.json({ chat, owner: owner.reverse(), clients });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "faça login" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { phone?: string; text?: string; name?: string };
  const text = (body.text ?? "").trim().slice(0, 1000);
  if (!text) return Response.json({ error: "mensagem vazia" }, { status: 400 });
  const phone = body.phone || SIM_ME;
  try {
    await withTenant(session.tenantId, () => handleInbound({ phone, name: body.name, text, simulated: true }));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
