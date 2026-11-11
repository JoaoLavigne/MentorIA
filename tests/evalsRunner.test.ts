import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { carregarDataset } from "../src/core/evals/dataset/loader.js";
import {
  FakeAgent,
  type AgentAdapter,
} from "../src/core/evals/runner/agentAdapter.js";
import {
  executarRodada,
  parseRunnerArgs,
  RunnerError,
  runEvals,
} from "../src/core/evals/runner/runner.js";
import type { MetricasChamada, Modo } from "../src/core/evals/types.js";

let sandboxRoot: string;
let resultsDir: string;

async function linhas(arquivo: string): Promise<string[]> {
  return (await readFile(arquivo, "utf8"))
    .split(/\r?\n/)
    .filter((linha) => linha.length > 0);
}

class TelemetryAgent implements AgentAdapter {
  private readonly chamadas: unknown[];

  constructor(modelo: string) {
    this.chamadas = [
      {
        modelo,
        fase: "perguntas",
        tokensEntrada: 10,
        tokensSaida: 4,
        tempoMs: 50,
      },
    ];
  }

  async iniciar(): Promise<void> {}

  async enviar(
    _fala: string,
  ): Promise<{ resposta: string; metricas: MetricasChamada }> {
    return {
      resposta: "Qual é a entrada do sistema?",
      metricas: { tempoMs: 0, fria: false },
    };
  }

  async lerEstado(): Promise<{ projetoMd: string; session: unknown }> {
    return {
      projetoMd: "# PROJETO\n",
      session: {
        version: 1,
        mode: "projeto" satisfies Modo,
        currentPhase: "perguntas",
        llmCalls: this.chamadas,
      },
    };
  }

  async encerrar(): Promise<void> {}
}

beforeEach(async () => {
  sandboxRoot = await mkdtemp(join(tmpdir(), "mentor-runner-tmp-"));
  resultsDir = await mkdtemp(join(tmpdir(), "mentor-runner-results-"));
});

afterEach(async () => {
  await rm(sandboxRoot, { recursive: true, force: true });
  await rm(resultsDir, { recursive: true, force: true });
});

describe("executarRodada", () => {
  it("roda os 40 casos com FakeAgent e grava resultados.jsonl", async () => {
    const rodada = await executarRodada({
      dataset: await carregarDataset(),
      modelos: ["modelo-fake"],
      adapterFactory: () => new FakeAgent(),
      sandboxRoot,
      resultsDir,
      rodadaId: "rodada-teste",
    });

    const registros = await linhas(rodada.arquivo);

    expect(rodada.resultados).toHaveLength(40);
    expect(registros).toHaveLength(40);
    expect(rodada.arquivo).toBe(
      join(resultsDir, "rodada-teste", "resultados.jsonl"),
    );

    for (const registro of registros) {
      const resultado = JSON.parse(registro) as {
        casoId: string;
        metricas: { tokensEntrada: number; tokensSaida: number };
      };

      expect(resultado.casoId).toBeTruthy();
      expect(resultado.metricas.tokensEntrada).toBe(0);
      expect(resultado.metricas.tokensSaida).toBe(0);
    }
  });

  it("filtra por categoria", async () => {
    const rodada = await executarRodada({
      dataset: await carregarDataset(),
      categorias: ["accuracy"],
      modelos: ["modelo-fake"],
      adapterFactory: () => new FakeAgent(),
      sandboxRoot,
      resultsDir,
      rodadaId: "rodada-categoria",
    });

    expect(rodada.resultados).toHaveLength(10);
    expect(
      rodada.resultados.every((r) => r.categoria === "accuracy"),
    ).toBe(true);
  });

  it("preserva o sandbox com keep", async () => {
    const rodada = await executarRodada({
      dataset: await carregarDataset(),
      casos: ["rel-001"],
      modelos: ["modelo-fake"],
      adapterFactory: () => new FakeAgent(),
      keep: true,
      sandboxRoot,
      resultsDir,
      rodadaId: "rodada-keep",
    });

    const pastas = await readdir(join(sandboxRoot, rodada.rodadaId));

    expect(pastas).toHaveLength(1);
    expect(pastas[0]).toContain("rel-001");
  });

  it("registra erro de um caso sem derrubar os demais", async () => {
    const rodada = await executarRodada({
      dataset: await carregarDataset(),
      casos: ["acc-001", "acc-002"],
      modelos: ["modelo-fake"],
      adapterFactory: (caso) =>
        new FakeAgent(
          caso.id === "acc-001" ? { erroNaFala: 0 } : {},
        ),
      sandboxRoot,
      resultsDir,
      rodadaId: "rodada-erro",
    });

    expect(rodada.resultados).toHaveLength(2);
    expect(rodada.resultados[0]?.motivo).toContain("falha simulada na fala 1");
    expect(rodada.resultados[1]?.motivo).not.toContain("falha simulada");
    expect(await linhas(rodada.arquivo)).toHaveLength(2);
  });

  it("repete o mesmo caso", async () => {
    const rodada = await executarRodada({
      dataset: await carregarDataset(),
      casos: ["rel-001"],
      modelos: ["modelo-fake"],
      repeticoes: 2,
      adapterFactory: () => new FakeAgent(),
      sandboxRoot,
      resultsDir,
      rodadaId: "rodada-repeticoes",
    });

    expect(rodada.resultados.map((r) => r.repeticao)).toEqual([1, 2]);
  });

  it("marca como fria apenas a primeira chamada do modelo na rodada", async () => {
    const rodada = await executarRodada({
      dataset: await carregarDataset(),
      casos: ["rel-001", "rel-002"],
      modelos: ["modelo-telemetria"],
      adapterFactory: (_caso, modelo) => new TelemetryAgent(modelo),
      sandboxRoot,
      resultsDir,
      rodadaId: "rodada-fria",
    });

    expect(rodada.resultados[0]?.metricas).toMatchObject({
      tokensEntrada: 10,
      tokensSaida: 4,
      tempoMs: 50,
      fria: true,
    });
    expect(rodada.resultados[1]?.metricas).toMatchObject({
      tokensEntrada: 10,
      tokensSaida: 4,
      tempoMs: 50,
      fria: false,
    });
  });

  it("rejeita repetições inválidas e filtro vazio", async () => {
    await expect(
      executarRodada({ dataset: [], repeticoes: 0 }),
    ).rejects.toBeInstanceOf(RunnerError);

    await expect(
      executarRodada({
        dataset: await carregarDataset(),
        casos: ["nao-existe"],
        adapterFactory: () => new FakeAgent(),
      }),
    ).rejects.toBeInstanceOf(RunnerError);
  });

  it("exporta o alias runEvals", () => {
    expect(runEvals).toBe(executarRodada);
  });
});

describe("parseRunnerArgs", () => {
  it("lê todas as opções da linha de comando", () => {
    expect(
      parseRunnerArgs([
        "--categoria",
        "accuracy",
        "--modelo",
        "m1",
        "--modelo",
        "m2",
        "--caso",
        "acc-001",
        "--repeticoes",
        "3",
        "--keep",
        "--rodada",
        "rodada-x",
      ]),
    ).toEqual({
      categorias: ["accuracy"],
      modelos: ["m1", "m2"],
      casos: ["acc-001"],
      repeticoes: 3,
      keep: true,
      rodadaId: "rodada-x",
    });
  });

  it("rejeita categoria e opções inválidas", () => {
    expect(() => parseRunnerArgs(["--categoria", "x"])).toThrow(RunnerError);
    expect(() => parseRunnerArgs(["--modelo"])).toThrow(RunnerError);
    expect(() => parseRunnerArgs(["--repeticoes", "0"])).toThrow(RunnerError);
    expect(() => parseRunnerArgs(["--desconhecida"])).toThrow(RunnerError);
  });
});
