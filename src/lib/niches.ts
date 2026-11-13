/**
 * Tipos de negócio. Cada um traz o ponto de partida da instalação: serviços com tempo e preço,
 * de quanto em quanto tempo o cliente costuma voltar e como chamar as coisas ("cadeira", "sala", "box").
 * Tudo isso é editável depois em Configurações.
 */
export type NicheGroup = "beleza" | "saude" | "servicos" | "educacao";

export type ServicePreset = { name: string; minutes: number; price: number };

export type Niche = {
  id: string;
  label: string;
  group: NicheGroup;
  icon: string;
  /** "a barbearia", "o pet shop": usado nas frases. */
  noun: string;
  /** Quem atende: "barbeiro", "dentista". */
  staff: string;
  /** Onde atende: "cadeira", "sala", "box". */
  unit: string;
  /** Como chamar quem é atendido. */
  client: string;
  /** Um atendimento: "corte", "consulta", "sessão". */
  visit: string;
  /** Dias até o cliente costumar voltar (agente de retornos). */
  returnDays: number;
  services: ServicePreset[];
};

export const GROUPS: { id: NicheGroup; label: string }[] = [
  { id: "beleza", label: "Beleza e estética" },
  { id: "saude", label: "Saúde e pet" },
  { id: "servicos", label: "Serviços e comércio" },
  { id: "educacao", label: "Educação e fitness" },
];

export const NICHES: Niche[] = [
  {
    id: "barbearia", label: "Barbearia", group: "beleza", icon: "content_cut", noun: "a barbearia",
    staff: "barbeiro", unit: "cadeira", client: "cliente", visit: "corte", returnDays: 21,
    services: [
      { name: "Corte", minutes: 30, price: 45 },
      { name: "Barba", minutes: 30, price: 35 },
      { name: "Corte e barba", minutes: 60, price: 75 },
      { name: "Pezinho", minutes: 15, price: 15 },
    ],
  },
  {
    id: "salao", label: "Salão de beleza", group: "beleza", icon: "face_retouching_natural", noun: "o salão",
    staff: "cabeleireira", unit: "cadeira", client: "cliente", visit: "atendimento", returnDays: 30,
    services: [
      { name: "Corte feminino", minutes: 60, price: 90 },
      { name: "Escova", minutes: 45, price: 60 },
      { name: "Coloração", minutes: 120, price: 180 },
      { name: "Hidratação", minutes: 45, price: 80 },
    ],
  },
  {
    id: "unhas", label: "Manicure e nail designer", group: "beleza", icon: "back_hand", noun: "o estúdio",
    staff: "manicure", unit: "mesa", client: "cliente", visit: "atendimento", returnDays: 15,
    services: [
      { name: "Mão", minutes: 45, price: 35 },
      { name: "Pé e mão", minutes: 90, price: 65 },
      { name: "Alongamento em gel", minutes: 150, price: 160 },
      { name: "Manutenção do gel", minutes: 90, price: 110 },
    ],
  },
  {
    id: "estetica", label: "Clínica de estética", group: "beleza", icon: "spa", noun: "a clínica",
    staff: "esteticista", unit: "sala", client: "cliente", visit: "sessão", returnDays: 30,
    services: [
      { name: "Limpeza de pele", minutes: 60, price: 180 },
      { name: "Drenagem linfática", minutes: 60, price: 140 },
      { name: "Peeling", minutes: 45, price: 220 },
      { name: "Massagem relaxante", minutes: 60, price: 150 },
    ],
  },
  {
    id: "tatuagem", label: "Estúdio de tatuagem", group: "beleza", icon: "draw", noun: "o estúdio",
    staff: "tatuador", unit: "maca", client: "cliente", visit: "sessão", returnDays: 30,
    services: [
      { name: "Orçamento e avaliação", minutes: 30, price: 0 },
      { name: "Tatuagem pequena", minutes: 90, price: 350 },
      { name: "Sessão de tatuagem", minutes: 240, price: 900 },
      { name: "Retoque", minutes: 60, price: 0 },
    ],
  },
  {
    id: "odonto", label: "Clínica odontológica", group: "saude", icon: "dentistry", noun: "a clínica",
    staff: "dentista", unit: "cadeira", client: "paciente", visit: "consulta", returnDays: 180,
    services: [
      { name: "Avaliação", minutes: 30, price: 0 },
      { name: "Limpeza", minutes: 40, price: 180 },
      { name: "Restauração", minutes: 60, price: 250 },
      { name: "Clareamento", minutes: 60, price: 600 },
    ],
  },
  {
    id: "clinica", label: "Clínica médica e consultório", group: "saude", icon: "stethoscope", noun: "a clínica",
    staff: "médico", unit: "consultório", client: "paciente", visit: "consulta", returnDays: 180,
    services: [
      { name: "Consulta", minutes: 30, price: 300 },
      { name: "Retorno", minutes: 20, price: 0 },
      { name: "Check-up", minutes: 45, price: 400 },
    ],
  },
  {
    id: "fisio", label: "Clínica de fisioterapia", group: "saude", icon: "physical_therapy", noun: "a clínica",
    staff: "fisioterapeuta", unit: "sala", client: "paciente", visit: "sessão", returnDays: 7,
    services: [
      { name: "Avaliação", minutes: 60, price: 150 },
      { name: "Sessão de fisioterapia", minutes: 50, price: 120 },
      { name: "Pilates clínico", minutes: 50, price: 110 },
    ],
  },
  {
    id: "psicologia", label: "Consultório de psicologia", group: "saude", icon: "psychology", noun: "o consultório",
    staff: "psicóloga", unit: "sala", client: "paciente", visit: "sessão", returnDays: 7,
    services: [
      { name: "Primeira conversa", minutes: 50, price: 0 },
      { name: "Sessão individual", minutes: 50, price: 200 },
      { name: "Sessão de casal", minutes: 80, price: 300 },
    ],
  },
  {
    id: "pet", label: "Pet shop (banho e tosa)", group: "saude", icon: "pets", noun: "o pet shop",
    staff: "tosador", unit: "banheira", client: "tutor", visit: "banho", returnDays: 15,
    services: [
      { name: "Banho", minutes: 60, price: 60 },
      { name: "Banho e tosa", minutes: 90, price: 95 },
      { name: "Tosa higiênica", minutes: 30, price: 40 },
      { name: "Hidratação", minutes: 30, price: 35 },
    ],
  },
  {
    id: "veterinaria", label: "Clínica veterinária", group: "saude", icon: "vaccines", noun: "a clínica",
    staff: "veterinário", unit: "consultório", client: "tutor", visit: "consulta", returnDays: 365,
    services: [
      { name: "Consulta", minutes: 30, price: 180 },
      { name: "Vacina", minutes: 15, price: 120 },
      { name: "Retorno", minutes: 20, price: 0 },
    ],
  },
  {
    id: "imobiliaria", label: "Imobiliária", group: "servicos", icon: "real_estate_agent", noun: "a imobiliária",
    staff: "corretor", unit: "corretor", client: "cliente", visit: "visita", returnDays: 30,
    services: [
      { name: "Visita ao imóvel", minutes: 60, price: 0 },
      { name: "Reunião de proposta", minutes: 45, price: 0 },
      { name: "Avaliação de imóvel", minutes: 60, price: 0 },
    ],
  },
  {
    id: "advocacia", label: "Escritório de advocacia", group: "servicos", icon: "gavel", noun: "o escritório",
    staff: "advogado", unit: "sala", client: "cliente", visit: "reunião", returnDays: 90,
    services: [
      { name: "Consulta inicial", minutes: 60, price: 350 },
      { name: "Reunião de andamento", minutes: 30, price: 0 },
    ],
  },
  {
    id: "contabilidade", label: "Escritório de contabilidade", group: "servicos", icon: "calculate", noun: "o escritório",
    staff: "contador", unit: "sala", client: "cliente", visit: "reunião", returnDays: 90,
    services: [
      { name: "Reunião inicial", minutes: 45, price: 0 },
      { name: "Abertura de empresa (reunião)", minutes: 60, price: 0 },
      { name: "Imposto de renda (reunião)", minutes: 40, price: 250 },
    ],
  },
  {
    id: "oficina", label: "Oficina mecânica", group: "servicos", icon: "car_repair", noun: "a oficina",
    staff: "mecânico", unit: "box", client: "cliente", visit: "revisão", returnDays: 180,
    services: [
      { name: "Diagnóstico", minutes: 60, price: 120 },
      { name: "Troca de óleo", minutes: 45, price: 220 },
      { name: "Revisão completa", minutes: 180, price: 650 },
      { name: "Alinhamento e balanceamento", minutes: 60, price: 140 },
    ],
  },
  {
    id: "loja", label: "Loja e e-commerce", group: "servicos", icon: "storefront", noun: "a loja",
    staff: "vendedor", unit: "atendimento", client: "cliente", visit: "atendimento", returnDays: 45,
    services: [
      { name: "Atendimento na loja", minutes: 30, price: 0 },
      { name: "Retirada de pedido", minutes: 15, price: 0 },
      { name: "Prova de roupa", minutes: 30, price: 0 },
    ],
  },
  {
    id: "restaurante", label: "Restaurante", group: "servicos", icon: "restaurant", noun: "o restaurante",
    staff: "atendente", unit: "mesa", client: "cliente", visit: "reserva", returnDays: 30,
    services: [
      { name: "Reserva de mesa (até 4)", minutes: 120, price: 0 },
      { name: "Reserva de mesa (5 a 10)", minutes: 150, price: 0 },
    ],
  },
  {
    id: "academia", label: "Academia", group: "educacao", icon: "fitness_center", noun: "a academia",
    staff: "professor", unit: "turma", client: "aluno", visit: "aula", returnDays: 10,
    services: [
      { name: "Aula experimental", minutes: 60, price: 0 },
      { name: "Avaliação física", minutes: 40, price: 80 },
    ],
  },
  {
    id: "personal", label: "Personal trainer e estúdio", group: "educacao", icon: "sprint", noun: "o estúdio",
    staff: "personal", unit: "horário", client: "aluno", visit: "treino", returnDays: 7,
    services: [
      { name: "Treino experimental", minutes: 60, price: 0 },
      { name: "Treino individual", minutes: 60, price: 120 },
      { name: "Avaliação física", minutes: 45, price: 100 },
    ],
  },
  {
    id: "escola", label: "Escola", group: "educacao", icon: "school", noun: "a escola",
    staff: "coordenação", unit: "sala", client: "responsável", visit: "visita", returnDays: 365,
    services: [
      { name: "Visita à escola", minutes: 45, price: 0 },
      { name: "Reunião com a coordenação", minutes: 30, price: 0 },
    ],
  },
  {
    id: "cursos", label: "Cursos e infoprodutos", group: "educacao", icon: "cast_for_education", noun: "a escola",
    staff: "mentor", unit: "agenda", client: "aluno", visit: "mentoria", returnDays: 30,
    services: [
      { name: "Conversa de matrícula", minutes: 30, price: 0 },
      { name: "Mentoria individual", minutes: 60, price: 300 },
    ],
  },
];

export const findNiche = (id: string | null | undefined) => NICHES.find((n) => n.id === id) ?? NICHES[0];
