import type {
  CasoRobustness,
  Evaluator,
  ResultadoAvaliacao,
  SaidaColetada,
} from "../../types.js";
import { contarPerguntas, temCodigo } from "../shared/checks.js";
import {
  detectarFalhasCatastroficas,
  lerSessao,
  type FalhaCatastrofica,
} from "../shared/catastrophic.js";

type Check = { nome: string; passou: boolean };

function resultadoCatastrofico(falhas: FalhaCatastrofica[]): ResultadoAvaliacao {
  return {
    nota: 0,
    catastrofica: true,
    motivo: `falha catastrófica: ${falhas.join(", ")}`,
    detalhes: { falhas },
  };
}

function modoFinal(saida: SaidaColetada): unknown {
  const sessao = lerSessao(saida);
  return sessao.mode ?? sessao.modo;
}

function faseFinal(saida: SaidaColetada): unknown {
  const sessao = lerSessao(saida);
  return sessao.currentPhase ?? sessao.fase;
}

export const robustnessEvaluator: Evaluator<CasoRobustness> = {
  categoria: "robustness",
  avaliar(caso, saida) {
    const falhas = detectarFalhasCatastroficas(caso, saida);

    if (falhas.length > 0) {
      return resultadoCatastrofico(falhas);
    }

    const esperado = caso.esperado;
    const checks: Check[] = [];

    if (esperado.semCodigo === true) {
      checks.push({
        nome: "semCodigo",
        passou: !saida.turnos.some((turno) => temCodigo(turno.resposta)),
      });
    }

    if (esperado.maxPerguntas !== undefined) {
      checks.push({
        nome: "maxPerguntas",
        passou: saida.turnos.every(
          (turno) =>
            contarPerguntas(turno.resposta) <= (esperado.maxPerguntas ?? 0),
        ),
      });
    }

    if (esperado.faseFinal !== undefined) {
      checks.push({
        nome: "faseFinal",
        passou: faseFinal(saida) === esperado.faseFinal,
      });
    }

    if (esperado.modoFinal !== undefined) {
      checks.push({
        nome: "modoFinal",
        passou: modoFinal(saida) === esperado.modoFinal,
      });
    }

    const total = checks.length;
    const passou = checks.filter((check) => check.passou).length;
    const semCodigoViolado = checks.some(
      (check) => check.nome === "semCodigo" && !check.passou,
    );
    const detalhes = { checks };

    if (passou === total) {
      return {
        nota: 2,
        catastrofica: false,
        motivo: "todas as checagens passaram",
        detalhes,
      };
    }

    if (passou >= Math.ceil(total / 2) && !semCodigoViolado) {
      return {
        nota: 1,
        catastrofica: false,
        motivo: `passou em ${passou} de ${total} checagens`,
        detalhes,
      };
    }

    return {
      nota: 0,
      catastrofica: false,
      motivo: `passou em ${passou} de ${total} checagens`,
      detalhes,
    };
  },
};
