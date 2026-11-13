/** Personalidade da recepção (compartilhado entre servidor e tela de configuração). */

export const TONES = {
  amigavel: { label: "Amigável", hint: "Simpática e próxima, como uma recepcionista querida." },
  profissional: { label: "Profissional", hint: "Educada, objetiva e segura, sem gírias." },
  acolhedor: { label: "Acolhedor", hint: "Calma e cuidadosa, passa tranquilidade (bom para saúde)." },
  descontraido: { label: "Descontraído", hint: "Leve e animada, pode usar expressões do dia a dia." },
  formal: { label: "Formal", hint: "Cerimoniosa e respeitosa, linguagem mais cuidada." },
} as const;
export type Tone = keyof typeof TONES;

/** Como a recepção fala: nome, tom e mensagens prontas. */
export type Persona = {
  assistantName: string;
  tone: Tone;
  treatment: "voce" | "senhor";
  emojis: "nenhum" | "poucos" | "varios";
  length: "curta" | "media";
  /** Já na primeira mensagem oferece os serviços e, sabendo o serviço, os horários mais próximos. */
  proactive: boolean;
  /** Primeira mensagem para quem chega. Pode usar {nome}, {negocio}, {assistente}, {servicos}. */
  greeting: string;
  /** Frase depois de marcar um horário. */
  closing: string;
  /** Fora do horário de funcionamento. */
  afterHours: string;
  /** Palavras ou assuntos que a recepção nunca usa. */
  avoid: string;
  /** Instruções livres do dono. */
  extra: string;
};

export const defaultPersona = (): Persona => ({
  assistantName: "",
  tone: "amigavel",
  treatment: "voce",
  emojis: "poucos",
  length: "curta",
  proactive: true,
  greeting: "",
  closing: "",
  afterHours: "",
  avoid: "",
  extra: "",
});

export const EMOJI_LABELS: Record<Persona["emojis"], string> = { nenhum: "Nenhum", poucos: "Poucos (no máximo 1)", varios: "Vários" };
export const LENGTH_LABELS: Record<Persona["length"], string> = { curta: "Curtas, estilo WhatsApp", media: "Médias, mais explicadas" };
export const TREATMENT_LABELS: Record<Persona["treatment"], string> = { voce: "Você", senhor: "O senhor / a senhora" };

type Vars = { nome?: string; negocio: string; servicos: string; assistente?: string };

const fill = (text: string, v: Vars) =>
  text
    .replace(/\{nome\}/gi, v.nome || "")
    .replace(/\{negocio\}/gi, v.negocio)
    .replace(/\{servicos\}/gi, v.servicos)
    .replace(/\{assistente\}/gi, v.assistente || "")
    .replace(/\s+([,!?.])/g, "$1")
    .replace(/,([.!?])/g, "$1")
    .replace(/ {2,}/g, " ")
    .trim();

/** Primeira mensagem sugerida para o tom escolhido (usada quando o dono não escreve uma). */
export function defaultGreeting(p: Persona): string {
  const quem = p.assistantName ? "aqui é {assistente}, da {negocio}" : "aqui é da {negocio}";
  const vc = p.treatment === "senhor";
  const e = p.emojis === "nenhum" ? "" : p.tone === "descontraido" ? " 😄" : " 😊";
  switch (p.tone) {
    case "profissional":
      return `Olá {nome}, ${quem}. ${vc ? "Em que posso ajudar o(a) senhor(a)" : "Posso ajudar você a agendar"}? Atendemos: {servicos}. Qual serviço ${vc ? "deseja" : "você quer"} e para qual dia?`;
    case "formal":
      return `Olá, {nome}. ${quem[0].toUpperCase()}${quem.slice(1)}. Será um prazer atendê-lo(a). Oferecemos: {servicos}. Qual serviço ${vc ? "o(a) senhor(a) deseja" : "deseja"} agendar e em qual data?`;
    case "acolhedor":
      return `Oi {nome}, tudo bem?${e} ${quem[0].toUpperCase()}${quem.slice(1)}, vou cuidar do seu atendimento. Temos: {servicos}. Me conta o que ${vc ? "o(a) senhor(a) precisa" : "você precisa"} e qual dia fica melhor?`;
    case "descontraido":
      return `E aí {nome}!${e} ${quem[0].toUpperCase()}${quem.slice(1)}. Bora marcar? Tem: {servicos}. Qual vai ser e pra quando?`;
    default:
      return `Oi {nome}!${e} ${quem[0].toUpperCase()}${quem.slice(1)}. Quer marcar um horário? Temos: {servicos}. Qual ${vc ? "o(a) senhor(a) prefere" : "você quer"} e pra qual dia?`;
  }
}

export const renderGreeting = (p: Persona, v: Vars) => fill(p.greeting.trim() || defaultGreeting(p), { ...v, assistente: p.assistantName });

/** Bloco de instruções de estilo para o modelo. */
export function personaInstructions(p: Persona, v: Vars): string {
  const lines = [
    `Estilo: ${TONES[p.tone].label.toLowerCase()} (${TONES[p.tone].hint})`,
    p.assistantName ? `Seu nome é ${p.assistantName}. Apresente-se com esse nome na primeira mensagem.` : "Não invente um nome para você.",
    p.treatment === "senhor" ? 'Trate a pessoa por "o senhor" / "a senhora".' : 'Trate a pessoa por "você".',
    p.emojis === "nenhum" ? "Não use emoji." : p.emojis === "poucos" ? "No máximo um emoji por mensagem." : "Pode usar emojis com naturalidade (até três por mensagem).",
    p.length === "curta" ? "Mensagens curtas: no máximo 3 linhas." : "Mensagens podem ter até 6 linhas, explicando com clareza.",
    `Modelo da primeira mensagem (adapte só o necessário, mantendo o sentido): "${renderGreeting(p, v)}"`,
    p.closing ? `Depois de marcar, termine com: "${fill(p.closing, { ...v, assistente: p.assistantName })}"` : "",
    p.afterHours ? `Se a mensagem chegar fora do horário de funcionamento, diga: "${fill(p.afterHours, { ...v, assistente: p.assistantName })}" e já ofereça os próximos horários.` : "",
    p.avoid ? `Nunca use estas palavras ou assuntos: ${p.avoid}.` : "",
    p.extra ? `Instruções do dono (siga sempre, desde que não contrariem as regras): ${p.extra}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}
