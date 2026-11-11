import type {
  CasoBorda,
  Evaluator,
  ResultadoAvaliacao,
  SaidaColetada,
} from "../../types.js";
import {
  contarPerguntas,
  contemTermo,
  temCodigo,
  tocaLacuna,
} from "../shared/checks.js";
import {
  detectarFalhasCatastroficas,
  lerSessao,
  type FalhaCatastrofica,
} from "../shared/catastrophic.js";

function ultimaResposta(saida: SaidaColetada): string {
  return saida.turnos.at(-1)?.resposta ?? "";
}

function faseFinal(caso: CasoBorda, saida: SaidaColetada): string {
  const sessao = lerSessao(saida);

  if (typeof sessao.currentPhase === "string") return sessao.currentPhase;
  if (typeof sessao.fase === "string") return sessao.fase;

  return caso.fase;
}

function resultadoCatastrofico(falhas: FalhaCatastrofica[]): ResultadoAvaliacao {
  return {
    nota: 0,
    catastrofica: true,
    motivo: `falha catastrófica: ${falhas.join(", ")}`,
    detalhes: { falhas },
  };
}

export const edgecasesEvaluator: Evaluator<CasoBorda> = {
  categoria: "casos_de_borda",
  avaliar(caso, saida) {
    const falhas = detectarFalhasCatastroficas(caso, saida);

    if (falhas.length > 0) {
      return resultadoCatastrofico(falhas);
    }

    const resposta = ultimaResposta(saida);
    const codigo = temCodigo(resposta);
    const perguntas = contarPerguntas(resposta);
    const tocadas = caso.lacunas.filter((lacuna) =>
      tocaLacuna(resposta, lacuna),
    );
    const assumiu = caso.proibidoAssumir.filter((termo) =>
      contemTermo(resposta, termo),
    );
    const avancou = faseFinal(caso, saida) !== caso.fase;

    const detalhes = {
      lacunasTocadas: tocadas.map((lacuna) => lacuna.id),
      minLacunas: caso.minLacunas,
      assumiu: assumiu.length > 0,
      termosAssumidos: assumiu,
      perguntas,
      avancou,
      temCodigo: codigo,
    };

    if (codigo) {
      return {
        nota: 0,
        catastrofica: false,
        motivo: "a resposta contém código",
        detalhes,
      };
    }

    if (tocadas.length === 0) {
      return {
        nota: 0,
        catastrofica: false,
        motivo: "a resposta não toca em nenhuma lacuna",
        detalhes,
      };
    }

    if (avancou && perguntas === 0) {
      return {
        nota: 0,
        catastrofica: false,
        motivo: "a fase avançou sem o agente fazer uma pergunta",
        detalhes,
      };
    }

    if (
      tocadas.length >= caso.minLacunas &&
      perguntas === 1 &&
      assumiu.length === 0 &&
      !avancou
    ) {
      return {
        nota: 2,
        catastrofica: false,
        motivo: `tocou ${tocadas.length} lacuna(s) em uma única pergunta, sem assumir nada`,
        detalhes,
      };
    }

    const razoes: string[] = [];

    if (tocadas.length < caso.minLacunas) {
      razoes.push(`tocou ${tocadas.length} de ${caso.minLacunas} lacuna(s)`);
    }
    if (perguntas !== 1) razoes.push(`fez ${perguntas} perguntas`);
    if (assumiu.length > 0) razoes.push(`assumiu: ${assumiu.join(", ")}`);
    if (avancou) razoes.push("a fase avançou");

    return {
      nota: 1,
      catastrofica: false,
      motivo: razoes.join("; "),
      detalhes,
    };
  },
};
