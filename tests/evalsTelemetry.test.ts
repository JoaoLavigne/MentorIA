import { describe, expect, it } from "vitest";
import {
  extrairChamada,
  extrairChamadas,
  extrairChamadasLLM,
  extrairDaRespostaOllama,
} from "../src/core/evals/runner/telemetry.js";

describe("extrairChamadas", () => {
  it("devolve lista vazia sem llmCalls", () => {
    expect(extrairChamadas({})).toEqual([]);
    expect(extrairChamadas(null)).toEqual([]);
    expect(extrairChamadas({ llmCalls: "nada" })).toEqual([]);
  });

  it("aceita a sessão serializada como string", () => {
    const chamadas = extrairChamadas(
      JSON.stringify({
        llmCalls: [
          { modelo: "m1", fase: "perguntas", tempoMs: 10 },
        ],
      }),
    );

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.modelo).toBe("m1");
  });

  it("marca a primeira chamada de cada modelo como fria", () => {
    const chamadas = extrairChamadas({
      llmCalls: [
        { modelo: "m1", fase: "a", tokensEntrada: 10, tokensSaida: 5, tempoMs: 100 },
        { modelo: "m2", fase: "a", tokensEntrada: 20, tokensSaida: 10, tempoMs: 200 },
        { modelo: "m1", fase: "b", tokensEntrada: 30, tokensSaida: 15, tempoMs: 300 },
        { modelo: "m2", fase: "b", tokensEntrada: 40, tokensSaida: 20, tempoMs: 400 },
      ],
    });

    expect(chamadas.map((c) => c.fria)).toEqual([true, true, false, false]);
    expect(chamadas.map((c) => c.fase)).toEqual(["a", "a", "b", "b"]);
  });

  it("lê campos no formato do Ollama e converte nanossegundos", () => {
    const chamadas = extrairChamadas({
      llm_calls: [
        {
          model: "llama3.2:3b",
          phase: "desenho",
          prompt_eval_count: 120,
          eval_count: 30,
          total_duration: 250_000_000,
        },
      ],
    });

    expect(chamadas).toEqual([
      {
        modelo: "llama3.2:3b",
        fase: "desenho",
        tokensEntrada: 120,
        tokensSaida: 30,
        tempoMs: 250,
        fria: true,
      },
    ]);
  });

  it("lê tokens do usageMetadata do Gemini", () => {
    const chamadas = extrairChamadas({
      llmCalls: [
        {
          model: "gemini-2.5-flash",
          phase: "perguntas",
          latencyMs: 900,
          usageMetadata: {
            promptTokenCount: 80,
            candidatesTokenCount: 12,
          },
        },
      ],
    });

    expect(chamadas[0]).toMatchObject({
      modelo: "gemini-2.5-flash",
      tokensEntrada: 80,
      tokensSaida: 12,
      tempoMs: 900,
    });
  });

  it("usa 0 quando tokens e tempo não existem", () => {
    const chamada = extrairChamada({ modelo: "m" });

    expect(chamada).toEqual({
      modelo: "m",
      fase: "desconhecida",
      tokensEntrada: 0,
      tokensSaida: 0,
      tempoMs: 0,
      fria: false,
    });
  });

  it("ignora entradas inválidas", () => {
    expect(extrairChamada("texto")).toBeNull();
    expect(
      extrairChamadas({ llmCalls: [null, "x", { modelo: "m", tempoMs: 1 }] }),
    ).toHaveLength(1);
  });

  it("exporta aliases para a mesma extração", () => {
    expect(extrairChamadasLLM).toBe(extrairChamadas);
    expect(extrairDaRespostaOllama).toBe(extrairChamada);
  });
});
