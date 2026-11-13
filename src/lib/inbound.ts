import "server-only";
import { upsertClient } from "./booking";
import { registerReview, reply } from "./brain";
import { handleReminderReply, pendingReview } from "./jobs";
import { agentOn, getSettings } from "./settings";
import { logMessage, send } from "./whatsapp";

/**
 * Toda mensagem que chega (do WhatsApp ou do simulador) passa por aqui: guarda no histórico,
 * resolve na hora o que tem resposta certa (1/2 do lembrete, nota da avaliação) e manda o resto
 * para a recepção.
 */
export async function handleInbound(input: { phone: string; name?: string; text: string; simulated?: boolean; extId?: string; now?: Date }) {
  const now = input.now ?? new Date();
  const fresh = await logMessage(input.phone, "in", input.text, null, input.extId);
  if (!fresh) return null; // mensagem repetida (o WhatsApp às vezes reenvia)
  const s = await getSettings();
  const c = await upsertClient(input.phone, undefined, Boolean(input.simulated));
  if (!c.name && input.name) c.name = input.name;

  if (agentOn(s, "lembretes") && (await handleReminderReply(s, c, input.text, now))) return "lembrete";

  const nota = input.text.trim().match(/^([1-5])(\s|$|[.!,]|\s*estrelas?)/i) ?? input.text.match(/^(⭐{1,5})$/);
  if (agentOn(s, "avaliacoes") && nota && (await pendingReview(c, now))) {
    const score = nota[1].startsWith("⭐") ? nota[1].length / "⭐".length : Number(nota[1]);
    const how = await registerReview(s, c, score, input.text, now);
    const text = how.startsWith("Nota boa")
      ? `Que bom, obrigado! 🙏${s.googleReviewUrl ? ` Se puder, deixa sua avaliação no Google, ajuda muito: ${s.googleReviewUrl}` : ""}`
      : "Poxa, sinto muito. Já avisei o responsável e ele vai falar com você pessoalmente.";
    await send(c.phone, text, "avaliacoes", { simulated: c.simulated });
    return "avaliacao";
  }

  if (!agentOn(s, "recepcao")) return null;
  return reply(s, c, { now });
}
