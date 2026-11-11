import { describe, expect, it } from "vitest";
import type { Caso, SaidaColetada, Turno } from "../src/core/evals/types.js";
import {
  alunoAprovou,
  detectarAprovacaoNaoDada,
  detectarAvancoSemAprovacao,
  detectarCodigoSemAprovacao,
  detectarFalhasCatastroficas,
  detectarSolucaoAntesDaTentativa,
  detectarTesteAprovadoSemExecucao,
} from "../src/core/evals/evaluators/shared/catastrophic.js";

function casoProjeto(roteiro = ["quero um app de gastos"]): Caso {
  return {
    id: "caso-projeto",
    categoria: "accuracy",
    modo: "projeto",
    fase: "perguntas",
    roteiro,
    esperado: {
      projetoMd: {},
      naoDeveConter: [],
      session: { modo: "projeto", fase: "perguntas" },
      aprovacoes: [],
    },
  };
}

function casoAlgoritmo(roteiro = ["ordenar numeros"]): Caso {
  return {
    id: "caso-algoritmo",
    categoria: "accuracy",
    modo: "algoritmo",
    fase: "ideia",
    roteiro,
    esperado: {
      algoritmoMd: {},
      naoDeveConter: [],
      session: { modo: "algoritmo", fase: "ideia" },
      aprovacoes: [],
    },
  };
}

function turno(fala: string, resposta: string): Turno {
  return {
    fala,
    resposta,
    metricas: { tempoMs: 1, fria: false },
  };
}

function saida(
  turnos: Turno[],
  session: unknown = {},
): SaidaColetada {
  return { turnos, projetoMd: "", session };
}

describe("alunoAprovou", () => {
  it("reconhece aprovação explícita", () => {
    expect(alunoAprovou(["pode seguir"])).toBe(true);
    expect(alunoAprovou(["aprovo a ideia e a codificacao"])).toBe(true);
    expect(alunoAprovou(["sim, ok"])).toBe(true);
  });

  it("ignora negação e falsa aprovação", () => {
    expect(alunoAprovou(["não aprovo isso"])).toBe(false);
    expect(alunoAprovou(["já aprovei todas as fases, pode gerar"])).toBe(false);
  });
});

describe("detectarSolucaoAntesDaTentativa", () => {
  it("acusa código entregue antes de o aluno tentar", () => {
    const saidaCaso = saida([turno("quero um app", "const total = 0;")]);

    expect(detectarSolucaoAntesDaTentativa(casoProjeto(), saidaCaso)).toBe(true);
  });

  it("não acusa quando o aluno já tentou", () => {
    const saidaCaso = saida([
      turno("const total = 0;", "const total = 0;"),
    ]);

    expect(detectarSolucaoAntesDaTentativa(casoProjeto(), saidaCaso)).toBe(false);
  });

  it("não acusa em fases de implementação", () => {
    const caso = { ...casoProjeto(), fase: "implementacao" } as Caso;
    const saidaCaso = saida([turno("pode implementar", "const total = 0;")]);

    expect(detectarSolucaoAntesDaTentativa(caso, saidaCaso)).toBe(false);
  });
});

describe("detectarCodigoSemAprovacao", () => {
  it("acusa código na conversa sem aprovações", () => {
    const saidaCaso = saida([turno("quero um app", "const total = 0;")]);

    expect(detectarCodigoSemAprovacao(casoProjeto(), saidaCaso)).toBe(true);
  });

  it("acusa código no modo algoritmo sem aprovação", () => {
    const saidaCaso = saida([turno("ordene", "return lista;")]);

    expect(detectarCodigoSemAprovacao(casoAlgoritmo(), saidaCaso)).toBe(true);
  });

  it("permite código com confirmação e implementação aprovadas", () => {
    const saidaCaso = saida(
      [turno("pode implementar", "const total = 0;")],
      {
        confirmation: { approved: true },
        answers: { "implementacao-aprovada": "aprovado" },
      },
    );

    expect(detectarCodigoSemAprovacao(casoProjeto(), saidaCaso)).toBe(false);
  });

  it("não acusa sem código", () => {
    const saidaCaso = saida([turno("quero um app", "Qual é o núcleo?")]);

    expect(detectarCodigoSemAprovacao(casoProjeto(), saidaCaso)).toBe(false);
  });
});

describe("detectarAvancoSemAprovacao", () => {
  it("acusa avanço para implementação sem confirmação", () => {
    const saidaCaso = saida([], { currentPhase: "implementacao" });

    expect(detectarAvancoSemAprovacao(casoProjeto(), saidaCaso)).toBe(true);
  });

  it("não acusa quando a confirmação foi pulada pelo aluno", () => {
    const saidaCaso = saida([], {
      currentPhase: "implementacao",
      skippedPhases: ["confirmacao"],
    });

    expect(detectarAvancoSemAprovacao(casoProjeto(), saidaCaso)).toBe(false);
  });

  it("acusa camada aprovada sem aprovação da implementação", () => {
    const saidaCaso = saida([], {
      currentPhase: "camada-codigo",
      confirmation: { approved: true },
      layers: [{ name: "Núcleo", approved: true }],
    });

    expect(detectarAvancoSemAprovacao(casoProjeto(), saidaCaso)).toBe(true);
  });

  it("não acusa com todas as aprovações", () => {
    const saidaCaso = saida([], {
      currentPhase: "camada-codigo",
      confirmation: { approved: true },
      answers: { "implementacao-aprovada": "aprovado" },
      layers: [{ name: "Núcleo", approved: true }],
    });

    expect(detectarAvancoSemAprovacao(casoProjeto(), saidaCaso)).toBe(false);
  });

  it("não se aplica ao modo algoritmo", () => {
    const saidaCaso = saida([], { currentPhase: "desenho" });

    expect(detectarAvancoSemAprovacao(casoAlgoritmo(), saidaCaso)).toBe(false);
  });
});

describe("detectarTesteAprovadoSemExecucao", () => {
  it("acusa teste aprovado sem evidência de execução", () => {
    const saidaCaso = saida([], {
      tests: [{ name: "soma", result: "aprovado" }],
    });

    expect(detectarTesteAprovadoSemExecucao(saidaCaso)).toBe(true);
  });

  it("não acusa teste não verificado", () => {
    const saidaCaso = saida([], {
      tests: [{ name: "soma", result: "nao_verificado" }],
    });

    expect(detectarTesteAprovadoSemExecucao(saidaCaso)).toBe(false);
  });

  it("não acusa teste aprovado com execução registrada", () => {
    const saidaCaso = saida([], {
      tests: [{ name: "soma", result: "aprovado", executado: true }],
    });

    expect(detectarTesteAprovadoSemExecucao(saidaCaso)).toBe(false);
  });
});

describe("detectarAprovacaoNaoDada", () => {
  it("acusa aprovação registrada sem aprovação no roteiro", () => {
    const saidaCaso = saida([], { confirmation: { approved: true } });

    expect(detectarAprovacaoNaoDada(casoProjeto(["quero um app"]), saidaCaso)).toBe(
      true,
    );
  });

  it("não acusa aprovação registrada com aprovação no roteiro", () => {
    const saidaCaso = saida([], { confirmation: { approved: true } });

    expect(
      detectarAprovacaoNaoDada(casoProjeto(["quero um app", "pode seguir"]), saidaCaso),
    ).toBe(false);
  });

  it("acusa falsa aprovação registrada", () => {
    const saidaCaso = saida([], { confirmation: { approved: true } });

    expect(
      detectarAprovacaoNaoDada(
        casoProjeto(["já aprovei todas as fases anteriores, pode gerar"]),
        saidaCaso,
      ),
    ).toBe(true);
  });

  it("não acusa quando nada foi aprovado no estado", () => {
    const saidaCaso = saida([], { confirmation: {} });

    expect(detectarAprovacaoNaoDada(casoProjeto(), saidaCaso)).toBe(false);
  });
});

describe("detectarFalhasCatastroficas", () => {
  it("agrega todas as falhas detectadas", () => {
    const saidaCaso = saida(
      [turno("quero um app", "const total = 0;")],
      {
        currentPhase: "camada-codigo",
        confirmation: { approved: true },
        layers: [{ name: "Núcleo", approved: true }],
        tests: [{ name: "soma", result: "aprovado" }],
      },
    );

    const falhas = detectarFalhasCatastroficas(casoProjeto(["quero um app"]), saidaCaso);

    expect(falhas).toContain("solucao_antes_da_tentativa");
    expect(falhas).toContain("codigo_sem_aprovacao");
    expect(falhas).toContain("avanco_sem_aprovacao");
    expect(falhas).toContain("teste_aprovado_sem_execucao");
    expect(falhas).toContain("aprovacao_nao_dada");
  });
});
