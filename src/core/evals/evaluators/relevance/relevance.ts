import type {
  CasoRelevance,
  Evaluator,
  ResultadoAvaliacao,
  SaidaColetada,
  Slot,
} from "../../types.js";
import {
  contarPerguntas,
  contemTermo,
  temCodigo,
} from "../shared/checks.js";
import {
  detectarFalhasCatastroficas,
  type FalhaCatastrofica,
} from "../shared/catastrophic.js";

export { contarPerguntas, normalizar, temCodigo } from "../shared/checks.js";

export const SLOT_ORDER: Slot[] = [
  "nucleo",
  "entradas",
  "processamento",
  "saidas",
  "criterios",
];

export const SLOT_TERMS: Record<Slot, string[]> = {
  nucleo: [
    "nucleo",
    "ideia central",
    "proposito",
    "objetivo",
    "essencial",
    "principal",
  ],
  entradas: [
    "entrada",
    "entradas",
    "dados",
    "recebe",
    "informa",
    "informacao",
    "usuario digita",
    "input",
  ],
  processamento: [
    "processamento",
    "processa",
    "calculo",
    "calcula",
    "logica",
    "fluxo",
    "como funciona",
    "regra",
    "regras",
    "etapas",
  ],
  saidas: [
    "saida",
    "saidas",
    "resultado",
    "resultados",
    "exibe",
    "mostra",
    "tela",
    "relatorio",
    "output",
  ],
  criterios: [
    "criterio",
    "criterios",
    "aceitacao",
    "sucesso",
    "requisito",
    "requisitos",
    "desempenho",
    "seguranca",
  ],
};

function ultimaResposta(saida: SaidaColetada): string {
  return saida.turnos.at(-1)?.resposta ?? "";
}

function tocaSlot(texto: string, slot: Slot): boolean {
  return SLOT_TERMS[slot].some((termo) => contemTermo(texto, termo));
}

export function avaliarRespostaRelevance(
  slotPendente: Slot,
  resposta: string,
): ResultadoAvaliacao {
  const codigo = temCodigo(resposta);
  const perguntas = contarPerguntas(resposta);
  const tocou = tocaSlot(resposta, slotPendente);
  const indice = SLOT_ORDER.indexOf(slotPendente);
  const posteriores = SLOT_ORDER.slice(indice + 1);
  const tocouPosterior = posteriores.some((slot) => tocaSlot(resposta, slot));

  const detalhes = {
    slotPendente,
    tocouSlot: tocou,
    tocouPosterior,
    perguntas,
    temCodigo: codigo,
  };

  if (codigo || !tocou) {
    return {
      nota: 0,
      catastrofica: false,
      motivo: codigo
        ? "a resposta contém código"
        : `a resposta não toca no slot pendente "${slotPendente}"`,
      detalhes,
    };
  }

  if (perguntas === 1 && !tocouPosterior) {
    return {
      nota: 2,
      catastrofica: false,
      motivo: "toca no slot pendente com uma única pergunta e sem adiantar slots posteriores",
      detalhes,
    };
  }

  const razoes: string[] = [];
  if (perguntas !== 1) razoes.push(`fez ${perguntas} perguntas`);
  if (tocouPosterior) razoes.push("adiantou slots posteriores");

  return {
    nota: 1,
    catastrofica: false,
    motivo: razoes.join(" e "),
    detalhes,
  };
}

export function evaluateRelevance(
  caso: { id: string; slotPendente: Slot },
  resposta: string,
): ResultadoAvaliacao {
  return avaliarRespostaRelevance(caso.slotPendente, resposta);
}

function resultadoCatastrofico(falhas: FalhaCatastrofica[]): ResultadoAvaliacao {
  return {
    nota: 0,
    catastrofica: true,
    motivo: `falha catastrófica: ${falhas.join(", ")}`,
    detalhes: { falhas },
  };
}

export const relevanceEvaluator: Evaluator<CasoRelevance> = {
  categoria: "relevance",
  avaliar(caso, saida) {
    const falhas = detectarFalhasCatastroficas(caso, saida);

    if (falhas.length > 0) {
      return resultadoCatastrofico(falhas);
    }

    return avaliarRespostaRelevance(caso.slotPendente, ultimaResposta(saida));
  },
};
