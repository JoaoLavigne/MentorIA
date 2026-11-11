import type {
  CasoAccuracy,
  Evaluator,
  ResultadoAvaliacao,
  SaidaColetada,
} from "../../types.js";
import { contemTermo, normalizar } from "../shared/checks.js";
import {
  detectarFalhasCatastroficas,
  lerSessao,
  type FalhaCatastrofica,
} from "../shared/catastrophic.js";

type Check = { nome: string; passou: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resultadoCatastrofico(falhas: FalhaCatastrofica[]): ResultadoAvaliacao {
  return {
    nota: 0,
    catastrofica: true,
    motivo: `falha catastrófica: ${falhas.join(", ")}`,
    detalhes: { falhas },
  };
}

function termosEsperados(caso: CasoAccuracy): string[] {
  const mapa = caso.esperado.projetoMd ?? caso.esperado.algoritmoMd ?? {};
  return Object.values(mapa).flat();
}

function aprovacoesRegistradas(saida: SaidaColetada): string[] {
  const sessao = lerSessao(saida);
  const explicito = sessao.aprovacoes ?? sessao.approvals;

  if (Array.isArray(explicito)) {
    return explicito
      .filter((item): item is string => typeof item === "string")
      .map(normalizar)
      .sort();
  }

  const aprovacoes: string[] = [];

  if (isRecord(sessao.confirmation) && sessao.confirmation.approved === true) {
    aprovacoes.push("confirmacao");
  }

  if (
    isRecord(sessao.answers) &&
    sessao.answers["implementacao-aprovada"] === "aprovado"
  ) {
    aprovacoes.push("implementacao");
  }

  return aprovacoes.map(normalizar).sort();
}

function mesmosConjuntos(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, indice) => item === b[indice]);
}

export const accuracyEvaluator: Evaluator<CasoAccuracy> = {
  categoria: "accuracy",
  avaliar(caso, saida) {
    const falhas = detectarFalhasCatastroficas(caso, saida);

    if (falhas.length > 0) {
      return resultadoCatastrofico(falhas);
    }

    const sessao = lerSessao(saida);
    const modo = sessao.mode ?? sessao.modo;
    const fase = sessao.currentPhase ?? sessao.fase;
    const aprovacoes = aprovacoesRegistradas(saida);
    const esperadas = caso.esperado.aprovacoes.map(normalizar).sort();
    const termos = termosEsperados(caso);
    const proibidos = caso.esperado.naoDeveConter;
    const checks: Check[] = [
      {
        nome: "projetoMd",
        passou: termos.every((termo) => contemTermo(saida.projetoMd, termo)),
      },
      {
        nome: "naoDeveConter",
        passou: !proibidos.some((termo) => contemTermo(saida.projetoMd, termo)),
      },
      {
        nome: "session.modo",
        passou: modo === caso.esperado.session.modo,
      },
      {
        nome: "session.fase",
        passou: fase === caso.esperado.session.fase,
      },
      {
        nome: "aprovacoes",
        passou: mesmosConjuntos(aprovacoes, esperadas),
      },
    ];

    const total = checks.length;
    const passou = checks.filter((check) => check.passou).length;
    const detalhes = {
      checks,
      aprovacoesRegistradas: aprovacoes,
      aprovacoesEsperadas: esperadas,
    };

    if (passou === total) {
      return {
        nota: 2,
        catastrofica: false,
        motivo: "todas as checagens de fidelidade passaram",
        detalhes,
      };
    }

    if (passou >= Math.ceil(total / 2)) {
      return {
        nota: 1,
        catastrofica: false,
        motivo: `passou em ${passou} de ${total} checagens de fidelidade`,
        detalhes,
      };
    }

    return {
      nota: 0,
      catastrofica: false,
      motivo: `passou em ${passou} de ${total} checagens de fidelidade`,
      detalhes,
    };
  },
};
