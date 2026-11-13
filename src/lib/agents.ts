/**
 * Os agentes que rodam de verdade nesta instalação. Cada um tem um fluxo escrito em português
 * (editável no painel): a recepção lê o fluxo como instrução; os outros seguem o fluxo no código
 * e usam o texto como explicação e como modelo das mensagens.
 */
export type AgentKey = "recepcao" | "lembretes" | "faltas" | "espera" | "retornos" | "orcamentos" | "avaliacoes" | "manha";

export type AgentDef = {
  key: AgentKey;
  name: string;
  sector: string;
  icon: string;
  color: string;
  when: string;
  flow: string[];
  human: string;
};

export const AGENTS: AgentDef[] = [
  {
    key: "recepcao",
    name: "Recepção no WhatsApp",
    sector: "Recepção",
    icon: "forum",
    color: "#fb923c",
    when: "Chega mensagem no WhatsApp, a qualquer hora.",
    flow: [
      "Na primeira mensagem, mesmo que seja só um oi: cumprimentar, apresentar o negócio, mostrar os serviços e perguntar qual a pessoa quer e para quando",
      "Se for a primeira vez, perguntar o nome junto; se já conhece, cumprimentar pelo nome",
      "Entender o que a pessoa quer: marcar, remarcar, cancelar, saber preço ou tirar dúvida",
      "Assim que souber o serviço, já oferecer os horários livres mais próximos (no máximo três), começando pelas datas mais perto",
      "Marcar só depois que a pessoa escolher um horário e mandar a confirmação com dia, hora e endereço",
      "Responder preço, endereço e horário de funcionamento com as informações do negócio, sem inventar nada",
      "Se não tiver horário no dia pedido, oferecer outro dia ou colocar na lista de espera",
    ],
    human: "Reclamação, urgência, pedido de desconto ou dúvida que as informações do negócio não respondem: avisa o dono e diz à pessoa que ele vai responder.",
  },
  {
    key: "lembretes",
    name: "Lembrete e confirmação",
    sector: "Recepção",
    icon: "notifications_active",
    color: "#fb923c",
    when: "Na véspera, às 18h. Se o horário foi marcado para o mesmo dia, até 2 horas antes.",
    flow: [
      "Mandar o lembrete com dia, hora e serviço",
      "Pedir para responder 1 para confirmar ou 2 para cancelar",
      "Se responder 1, marcar como confirmado",
      "Se responder 2, cancelar e oferecer outro horário; a vaga vai para a lista de espera",
    ],
    human: "Ninguém confirma até 2 horas antes: o horário aparece em amarelo na agenda do dia.",
  },
  {
    key: "faltas",
    name: "Aviso de falta",
    sector: "Faltas",
    icon: "event_busy",
    color: "#fb7185",
    when: "Alguém marca a falta na agenda.",
    flow: [
      "Mandar mensagem na mesma hora dizendo que sentiu falta da pessoa, sem bronca",
      "Oferecer dois horários livres para remarcar",
      "Registrar a falta na ficha do cliente",
    ],
    human: "Terceira falta do mesmo cliente: avisa o dono.",
  },
  {
    key: "espera",
    name: "Lista de espera",
    sector: "Faltas",
    icon: "group_add",
    color: "#fb7185",
    when: "Um horário é cancelado com pelo menos 1 hora de antecedência.",
    flow: [
      "Procurar quem está na lista de espera para o mesmo serviço",
      "Oferecer a vaga para a primeira pessoa da lista",
      "Quem responder primeiro fica com o horário",
    ],
    human: "Ninguém na lista: a vaga fica livre na agenda e no link de horários.",
  },
  {
    key: "retornos",
    name: "Retornos",
    sector: "Retornos",
    icon: "autorenew",
    color: "#a78bfa",
    when: "Todo dia, entre 9h e 11h.",
    flow: [
      "Buscar quem foi atendido e passou do tempo de voltar, sem nada marcado",
      "Escolher um horário livre para o mesmo serviço nos próximos dias",
      "Mandar a mensagem pelo nome, citando o último atendimento e oferecendo esse horário",
      "Chamar no máximo 20 pessoas por dia e nunca a mesma pessoa duas vezes no mês",
      "Se a pessoa responder, a recepção marca pela resposta",
    ],
    human: "Quem pede para não receber mensagem sai da lista para sempre.",
  },
  {
    key: "orcamentos",
    name: "Orçamentos",
    sector: "Orçamentos",
    icon: "request_quote",
    color: "#f472b6",
    when: "Você cria o orçamento no painel e manda.",
    flow: [
      "Montar a mensagem com os itens, os valores e o total",
      "Explicar em palavras simples o que vai ser feito e por quê",
      "Três dias depois, se a pessoa não respondeu, perguntar se ficou alguma dúvida e oferecer marcar",
      "Dez dias depois, uma última vez; depois disso para",
    ],
    human: "Pedido de desconto ou negociação: avisa o dono.",
  },
  {
    key: "avaliacoes",
    name: "Avaliações",
    sector: "Avaliações",
    icon: "star",
    color: "#60a5fa",
    when: "No dia seguinte ao atendimento, a partir das 10h.",
    flow: [
      "Agradecer pela visita e pedir uma nota de 1 a 5",
      "Nota 4 ou 5: agradecer e mandar o link de avaliação no Google",
      "Nota 3 ou menos: não mandar link, avisar o dono na hora com o que a pessoa escreveu",
      "Dizer à pessoa que o dono vai entrar em contato",
    ],
    human: "Toda nota baixa vai primeiro para o dono, antes de virar avaliação pública.",
  },
  {
    key: "manha",
    name: "Página da manhã",
    sector: "Gestão",
    icon: "wb_sunny",
    color: "#4ade80",
    when: "Todo dia às 7h, no WhatsApp do dono.",
    flow: [
      "Contar quantos estão marcados hoje e o primeiro horário",
      "Contar quem passou da hora de voltar e quantos já foram chamados",
      "Somar o que se perdeu ontem: faltas e cancelamentos sem reposição",
      "Somar os orçamentos esperando resposta",
      "Mandar tudo numa mensagem curta",
    ],
    human: "É a mensagem do dono: ninguém mais recebe.",
  },
];

export const agentDef = (key: AgentKey) => AGENTS.find((a) => a.key === key)!;
