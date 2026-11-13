import "server-only";

/** Mapa completo de agentes de cada nicho (src/data/maps), usado na página Mapa do painel. */
export type MapAgent = { name: string; when: string; uses: string[]; flow: string[]; human: string; example: { from: string; in: string; out: string } };
export type MapSector = { name: string; icon: string; line: string; agents: MapAgent[] };
export type NicheMap = {
  id: string;
  label: string;
  title: string;
  owner: string;
  intro: string;
  sectors: MapSector[];
  morning: { when: string; flow: string[]; stats: { value: string; label: string; sub: string }[] };
};

export async function loadMap(id: string): Promise<NicheMap | null> {
  try {
    const mod = await import(`@/data/maps/${id}.json`);
    return (mod.default ?? mod) as NicheMap;
  } catch {
    return null;
  }
}

/** Setores que esta instalação já executa (o resto do mapa é o que dá para montar depois). */
export const LIVE_SECTOR = /recep|atendimento|retorno|falta|espera|orçament|orcament|proposta|avalia|agenda/i;
