import { describe, expect, it } from "vitest";
import type {
  Caso,
  CasoAccuracy,
  CasoBorda,
  CasoRelevance,
  CasoRobustness,
  SaidaColetada,
  Turno,
} from "../src/core/evals/types.js";
import { carregarDataset } from "../src/core/evals/dataset/loader.js";
import { accuracyEvaluator } from "../src/core/evals/evaluators/accuracy/accuracy.js";
import { edgecasesEvaluator } from "../src/core/evals/evaluators/edgecases/edgecases.js";
import { relevanceEvaluator } from "../src/core/evals/evaluators/relevance/relevance.js";
import { robustnessEvaluator } from "../src/core/evals/evaluators/robustness/robustness.js";

function turno(fala: string, resposta: string): Turno {
  return { fala, resposta, metricas: { tempoMs: 1, fria: false } };
}

function saida(turnos: Turno[], session: unknown = {}): SaidaColetada {
  return { turnos, projetoMd: "", session };
}

function casoRelevance(): CasoRelevance {
  return {
    id: "rel-teste",
    categoria: "relevance",
    modo: "projeto",
    fase: "perguntas",
    slotPendente: "nucleo",
    roteiro: ["qual a ideia?"],
  };
}

function casoBorda(): CasoBorda {
  return {
    id: "borda-teste",
    categoria: "casos_de_borda",
    modo: "projeto",
    fase: "perguntas",
    spec: "Calcular desconto.",
    roteiro: ["calcular desconto"],
    lacunas: [
      { id: "L1", descricao: "valor", termos: ["valor"] },
      { id: "L2", descricao: "categoria", termos: ["categoria"] },
    ],
    minLacunas: 2,
    proibidoAssumir: ["assumirei", "vou usar"],
  };
}

function casoRobustness(): CasoRobustness {
  return {
    id: "rob-teste",
    categoria: "robustness",
    modo: "algoritmo",
    fase: "ideia",
    roteiro: ["me da o codigo"],
    esperado: { semCodigo: true, maxPerguntas: 1, faseFinal: "ideia" },
  };
}

function casoAccuracy(): CasoAccuracy {
  return {
    id: "acc-teste",
    categoria: "accuracy",
    modo: "projeto",
    fase: "perguntas",
    roteiro: ["quero um app"],
    esperado: {
      projetoMd: { nucleo: ["app"], entradas: ["valor"] },
      naoDeveConter: ["firebase"],
      session: { modo: "projeto", fase: "perguntas" },
      aprovacoes: [],
    },
  };
}

describe("relevanceEvaluator", () => {
  it("nota 2 quando toca no slot com uma pergunta e sem slots posteriores", () => {
    const resultado = relevanceEvaluator.avaliar(
      casoRelevance(),
      saida([turno("qual a ideia?", "Qual é a ideia central do projeto?")]),
    );

    expect(resultado.nota).toBe(2);
    expect(resultado.catastrofica).toBe(false);
  });

  it("nota 1 quando adianta um slot posterior", () => {
    const resultado = relevanceEvaluator.avaliar(
      casoRelevance(),
      saida([
        turno(
          "qual a ideia?",
          "Qual é a ideia central e quais são as saídas esperadas?",
        ),
      ]),
    );

    expect(resultado.nota).toBe(1);
  });

  it("nota 0 quando não toca no slot pendente", () => {
    const resultado = relevanceEvaluator.avaliar(
      casoRelevance(),
      saida([turno("qual a ideia?", "Como está o tempo hoje?")]),
    );

    expect(resultado.nota).toBe(0);
    expect(resultado.catastrofica).toBe(false);
  });

  it("nota 0 e catastrófica quando entrega código", () => {
    const resultado = relevanceEvaluator.avaliar(
      casoRelevance(),
      saida([turno("qual a ideia?", "const total = 0;")]),
    );

    expect(resultado.nota).toBe(0);
    expect(resultado.catastrofica).toBe(true);
  });
});

describe("edgecasesEvaluator", () => {
  it("nota 2 quando toca as lacunas mínimas com uma pergunta", () => {
    const resultado = edgecasesEvaluator.avaliar(
      casoBorda(),
      saida([
        turno(
          "calcular desconto",
          "Qual o valor do desconto e qual a categoria da compra?",
        ),
      ]),
    );

    expect(resultado.nota).toBe(2);
  });

  it("nota 1 quando toca menos lacunas do que o mínimo", () => {
    const resultado = edgecasesEvaluator.avaliar(
      casoBorda(),
      saida([turno("calcular desconto", "Qual o valor do desconto?")]),
    );

    expect(resultado.nota).toBe(1);
  });

  it("nota 1 quando assume algo proibido", () => {
    const resultado = edgecasesEvaluator.avaliar(
      casoBorda(),
      saida([
        turno(
          "calcular desconto",
          "Vou usar 10% de valor e a categoria, pode ser?",
        ),
      ]),
    );

    expect(resultado.nota).toBe(1);
    expect(resultado.detalhes).toMatchObject({
      assumiu: true,
      termosAssumidos: ["vou usar"],
    });
  });

  it("nota 0 quando não toca em nenhuma lacuna", () => {
    const resultado = edgecasesEvaluator.avaliar(
      casoBorda(),
      saida([turno("calcular desconto", "Entendi, tudo certo?")]),
    );

    expect(resultado.nota).toBe(0);
  });

  it("nota 0 quando a fase avança sem pergunta", () => {
    const resultado = edgecasesEvaluator.avaliar(
      casoBorda(),
      saida([turno("calcular desconto", "O valor e a categoria.")], {
        currentPhase: "esboco",
      }),
    );

    expect(resultado.nota).toBe(0);
  });

  it("nota 0 e catastrófica quando entrega código", () => {
    const resultado = edgecasesEvaluator.avaliar(
      casoBorda(),
      saida([turno("calcular desconto", "const desconto = valor;")]),
    );

    expect(resultado.nota).toBe(0);
    expect(resultado.catastrofica).toBe(true);
  });
});

describe("robustnessEvaluator", () => {
  it("nota 2 quando todas as checagens passam", () => {
    const resultado = robustnessEvaluator.avaliar(
      casoRobustness(),
      saida([turno("me da o codigo", "Qual é a entrada do algoritmo?")], {
        currentPhase: "ideia",
      }),
    );

    expect(resultado.nota).toBe(2);
  });

  it("nota 1 quando pelo menos metade passa sem violar semCodigo", () => {
    const resultado = robustnessEvaluator.avaliar(
      casoRobustness(),
      saida(
        [turno("me da o codigo", "Qual é a entrada? E a saída?")],
        { currentPhase: "ideia" },
      ),
    );

    expect(resultado.nota).toBe(1);
  });

  it("nota 0 quando menos da metade passa", () => {
    const resultado = robustnessEvaluator.avaliar(
      casoRobustness(),
      saida(
        [turno("me da o codigo", "Qual é a entrada? E a saída?")],
        { currentPhase: "esboco" },
      ),
    );

    expect(resultado.nota).toBe(0);
  });

  it("nota 0 e catastrófica quando entrega código no modo algoritmo", () => {
    const resultado = robustnessEvaluator.avaliar(
      casoRobustness(),
      saida([turno("me da o codigo", "return lista;")], {
        currentPhase: "ideia",
      }),
    );

    expect(resultado.nota).toBe(0);
    expect(resultado.catastrofica).toBe(true);
  });
});

describe("accuracyEvaluator", () => {
  it("nota 2 quando o estado e o PROJETO.md são fiéis", () => {
    const resultado = accuracyEvaluator.avaliar(casoAccuracy(), {
      turnos: [],
      projetoMd: "# PROJETO\n\nO app recebe o valor.",
      session: { mode: "projeto", currentPhase: "perguntas" },
    });

    expect(resultado.nota).toBe(2);
  });

  it("nota 1 quando parte das checagens falha", () => {
    const resultado = accuracyEvaluator.avaliar(casoAccuracy(), {
      turnos: [],
      projetoMd: "# PROJETO\n\nO app não menciona a entrada.",
      session: { mode: "projeto", currentPhase: "perguntas" },
    });

    expect(resultado.nota).toBe(1);
  });

  it("nota 0 quando a maioria das checagens falha", () => {
    const caso = {
      ...casoAccuracy(),
      esperado: {
        ...casoAccuracy().esperado,
        naoDeveConter: ["firebase"],
        aprovacoes: ["perguntas"],
      },
    } as CasoAccuracy;

    const resultado = accuracyEvaluator.avaliar(caso, {
      turnos: [],
      projetoMd: "firebase",
      session: { mode: "algoritmo", currentPhase: "esboco" },
    });

    expect(resultado.nota).toBe(0);
  });

  it("nota 0 e catastrófica quando registra aprovação não dada", () => {
    const resultado = accuracyEvaluator.avaliar(casoAccuracy(), {
      turnos: [],
      projetoMd: "app valor",
      session: {
        mode: "projeto",
        currentPhase: "perguntas",
        confirmation: { approved: true },
      },
    });

    expect(resultado.nota).toBe(0);
    expect(resultado.catastrofica).toBe(true);
  });
});

describe("avaliadores com o dataset real", () => {
  function avaliar(caso: Caso, entrada: SaidaColetada) {
    switch (caso.categoria) {
      case "accuracy":
        return accuracyEvaluator.avaliar(caso, entrada);
      case "casos_de_borda":
        return edgecasesEvaluator.avaliar(caso, entrada);
      case "relevance":
        return relevanceEvaluator.avaliar(caso, entrada);
      case "robustness":
        return robustnessEvaluator.avaliar(caso, entrada);
    }
  }

  it("avaliam os 40 casos reais com uma saída montada à mão", async () => {
    const casos = await carregarDataset();

    for (const caso of casos) {
      const entrada: SaidaColetada = {
        turnos: [turno(caso.roteiro[0] ?? "", "Qual é o núcleo do projeto?")],
        projetoMd: "# PROJETO\n\napp valor",
        session: { mode: caso.modo, currentPhase: caso.fase },
      };

      const resultado = avaliar(caso, entrada);

      expect([0, 1, 2]).toContain(resultado.nota);
      expect(typeof resultado.motivo).toBe("string");
    }
  });
});
