import { describe, expect, it } from "vitest";
import {
  agregar,
  agregarPorFase,
  agregarPorModelo,
  media,
  mediana,
  metricasDoCaso,
  p95,
  totaisDoCaso,
} from "../src/core/evals/evaluators/cost-latency/metrics.js";
import type { ChamadaLLM } from "../src/core/evals/types.js";

function chamada(
  tempoMs: number,
  extras: Partial<ChamadaLLM> = {},
): ChamadaLLM {
  return {
    modelo: "m1",
    fase: "perguntas",
    tokensEntrada: 0,
    tokensSaida: 0,
    tempoMs,
    fria: false,
    ...extras,
  };
}

describe("média, mediana e p95", () => {
  it("trata listas vazias", () => {
    expect(media([])).toBe(0);
    expect(mediana([])).toBe(0);
    expect(p95([])).toBe(0);
  });

  it("calcula média e mediana", () => {
    expect(media([2, 4])).toBe(3);
    expect(mediana([1, 2, 3])).toBe(2);
    expect(mediana([1, 2, 3, 4])).toBe(2.5);
  });

  it("calcula p95 nearest-rank com conjuntos pequenos", () => {
    expect(p95([10])).toBe(10);
    expect(p95([10, 20, 30])).toBe(30);
    expect(p95(Array.from({ length: 20 }, (_, i) => i + 1))).toBe(19);
    expect(p95(Array.from({ length: 100 }, (_, i) => i + 1))).toBe(95);
  });

  it("mantém valores iguais", () => {
    expect(media([7, 7, 7])).toBe(7);
    expect(mediana([7, 7, 7])).toBe(7);
    expect(p95([7, 7, 7])).toBe(7);
  });
});

describe("agregar", () => {
  it("exclui a chamada fria das médias", () => {
    const chamadas = [
      chamada(1000, { fria: true, tokensEntrada: 100, tokensSaida: 50 }),
      chamada(100, { tokensEntrada: 10, tokensSaida: 5 }),
      chamada(200, { tokensEntrada: 20, tokensSaida: 10 }),
    ];

    expect(agregar(chamadas)).toEqual({
      chamadas: 2,
      tokensEntrada: 30,
      tokensSaida: 15,
      tempoMedioMs: 150,
      tempoMedianoMs: 150,
      p95Ms: 200,
    });
  });

  it("pode incluir as chamadas frias", () => {
    const chamadas = [
      chamada(1000, { fria: true, tokensEntrada: 100 }),
      chamada(100, { tokensEntrada: 10 }),
      chamada(200, { tokensEntrada: 20 }),
    ];

    expect(agregar(chamadas, { excluirFrias: false })).toMatchObject({
      chamadas: 3,
      tokensEntrada: 130,
      tempoMedioMs: 1300 / 3,
      p95Ms: 1000,
    });
  });

  it("agrupa por modelo e por fase", () => {
    const chamadas = [
      chamada(100, { modelo: "m1", fase: "a", fria: true }),
      chamada(100, { modelo: "m1", fase: "a" }),
      chamada(300, { modelo: "m1", fase: "a" }),
      chamada(500, { modelo: "m2", fase: "b", fria: true }),
      chamada(700, { modelo: "m2", fase: "b" }),
    ];

    expect(agregarPorModelo(chamadas).m1).toMatchObject({
      chamadas: 2,
      tempoMedioMs: 200,
    });
    expect(agregarPorModelo(chamadas).m2).toMatchObject({
      chamadas: 1,
      tempoMedioMs: 700,
    });
    expect(agregarPorFase(chamadas).a).toMatchObject({
      chamadas: 2,
      tempoMedioMs: 200,
    });
    expect(agregarPorFase(chamadas).b).toMatchObject({
      chamadas: 1,
      tempoMedioMs: 700,
    });
  });
});

describe("totaisDoCaso", () => {
  it("soma tokens e tempo de todas as chamadas do caso", () => {
    const chamadas = [
      chamada(1000, { fria: true, tokensEntrada: 100, tokensSaida: 50 }),
      chamada(100, { tokensEntrada: 10, tokensSaida: 5 }),
      chamada(200, { tokensEntrada: 20, tokensSaida: 10 }),
    ];

    expect(totaisDoCaso(chamadas)).toEqual({
      chamadas: 3,
      tokensEntrada: 130,
      tokensSaida: 65,
      tempoMs: 1300,
      fria: true,
    });
    expect(metricasDoCaso).toBe(totaisDoCaso);
  });
});
