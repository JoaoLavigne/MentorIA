import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FakeAgent, faseInicial } from "../src/core/evals/runner/agentAdapter.js";
import { executarRoteiro } from "../src/core/evals/runner/studentScript.js";
import type { CasoRobustness } from "../src/core/evals/types.js";

let pastaProjeto: string;

function caso(roteiro: string[]): CasoRobustness {
  return {
    id: "rob-001",
    categoria: "robustness",
    modo: "projeto",
    fase: "perguntas",
    roteiro,
    esperado: {},
  };
}

beforeEach(async () => {
  pastaProjeto = await mkdtemp(join(tmpdir(), "mentor-roteiro-"));
});

afterEach(async () => {
  await rm(pastaProjeto, { recursive: true, force: true });
});

describe("executarRoteiro", () => {
  it("gera um turno por fala e devolve o estado final", async () => {
    const agent = new FakeAgent({ respostas: ["A", "B", "C"] });
    const resultado = await executarRoteiro(
      agent,
      caso(["fala 1", "fala 2", "fala 3"]),
      { pastaProjeto, modelo: "modelo-fake" },
    );

    expect(resultado.erro).toBeUndefined();
    expect(resultado.saida.turnos).toHaveLength(3);
    expect(resultado.saida.turnos.map((t) => t.resposta)).toEqual(["A", "B", "C"]);
    expect(resultado.saida.turnos.map((t) => t.fala)).toEqual([
      "fala 1",
      "fala 2",
      "fala 3",
    ]);
    expect(resultado.saida.projetoMd).toContain("A");
    expect(resultado.saida.projetoMd).toContain("C");
    expect(resultado.saida.session).toMatchObject({
      mode: "projeto",
      currentPhase: "perguntas",
    });
  });

  it("aceita roteiro vazio", async () => {
    const agent = new FakeAgent();
    const resultado = await executarRoteiro(agent, caso([]), {
      pastaProjeto,
      modelo: "modelo-fake",
    });

    expect(resultado.erro).toBeUndefined();
    expect(resultado.saida.turnos).toEqual([]);
    expect(resultado.saida.session).toMatchObject({ currentPhase: "perguntas" });
  });

  it("registra erro na fala sem derrubar a execução", async () => {
    const agent = new FakeAgent({
      respostas: ["A", "B", "C"],
      erroNaFala: 1,
    });

    const resultado = await executarRoteiro(
      agent,
      caso(["fala 1", "fala 2", "fala 3"]),
      { pastaProjeto, modelo: "modelo-fake" },
    );

    expect(resultado.erro).toContain("falha simulada na fala 2");
    expect(resultado.saida.turnos).toHaveLength(1);
    expect(resultado.saida.session).toMatchObject({ mode: "projeto" });
  });
});

describe("faseInicial", () => {
  it("mantém fases válidas do engine", () => {
    expect(faseInicial("projeto", "perguntas")).toBe("perguntas");
    expect(faseInicial("algoritmo", "desenho")).toBe("desenho");
  });

  it("mapeia fases do dataset que não existem no engine", () => {
    expect(faseInicial("projeto", "codificacao")).toBe("implementacao");
    expect(faseInicial("projeto", "testes")).toBe("entendimento");
    expect(faseInicial("algoritmo", "codificacao")).toBe("enunciado");
    expect(faseInicial("projeto", "desconhecida")).toBe("conhecendo-dev");
  });
});
