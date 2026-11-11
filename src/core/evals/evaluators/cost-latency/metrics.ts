import type { ChamadaLLM } from "../../types.js";

export type Agregado = {
  chamadas: number;
  tokensEntrada: number;
  tokensSaida: number;
  tempoMedioMs: number;
  tempoMedianoMs: number;
  p95Ms: number;
};

export type TotaisCaso = {
  chamadas: number;
  tokensEntrada: number;
  tokensSaida: number;
  tempoMs: number;
  fria: boolean;
};

export type AgregarOptions = {
  excluirFrias?: boolean;
};

function soma(valores: number[]): number {
  return valores.reduce((total, valor) => total + valor, 0);
}

export function media(valores: number[]): number {
  if (valores.length === 0) return 0;

  return soma(valores) / valores.length;
}

export function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;

  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);

  if (ordenados.length % 2 === 1) return ordenados[meio]!;

  return (ordenados[meio - 1]! + ordenados[meio]!) / 2;
}

export function p95(valores: number[]): number {
  if (valores.length === 0) return 0;

  const ordenados = [...valores].sort((a, b) => a - b);
  const posicao = Math.ceil(0.95 * ordenados.length);

  return ordenados[posicao - 1]!;
}

export function agregar(
  chamadas: ChamadaLLM[],
  options: AgregarOptions = {},
): Agregado {
  const excluirFrias = options.excluirFrias ?? true;
  const consideradas = excluirFrias
    ? chamadas.filter((chamada) => !chamada.fria)
    : chamadas;
  const tempos = consideradas.map((chamada) => chamada.tempoMs);

  return {
    chamadas: consideradas.length,
    tokensEntrada: soma(consideradas.map((chamada) => chamada.tokensEntrada)),
    tokensSaida: soma(consideradas.map((chamada) => chamada.tokensSaida)),
    tempoMedioMs: media(tempos),
    tempoMedianoMs: mediana(tempos),
    p95Ms: p95(tempos),
  };
}

function agrupar(
  chamadas: ChamadaLLM[],
  chave: (chamada: ChamadaLLM) => string,
  options: AgregarOptions,
): Record<string, Agregado> {
  const grupos = new Map<string, ChamadaLLM[]>();

  for (const chamada of chamadas) {
    const grupo = chave(chamada);
    const atual = grupos.get(grupo) ?? [];
    atual.push(chamada);
    grupos.set(grupo, atual);
  }

  const resultado: Record<string, Agregado> = {};

  for (const [grupo, itens] of grupos) {
    resultado[grupo] = agregar(itens, options);
  }

  return resultado;
}

export function agregarPorModelo(
  chamadas: ChamadaLLM[],
  options: AgregarOptions = {},
): Record<string, Agregado> {
  return agrupar(chamadas, (chamada) => chamada.modelo, options);
}

export function agregarPorFase(
  chamadas: ChamadaLLM[],
  options: AgregarOptions = {},
): Record<string, Agregado> {
  return agrupar(chamadas, (chamada) => chamada.fase, options);
}

export function totaisDoCaso(chamadas: ChamadaLLM[]): TotaisCaso {
  return {
    chamadas: chamadas.length,
    tokensEntrada: soma(chamadas.map((chamada) => chamada.tokensEntrada)),
    tokensSaida: soma(chamadas.map((chamada) => chamada.tokensSaida)),
    tempoMs: soma(chamadas.map((chamada) => chamada.tempoMs)),
    fria: chamadas.some((chamada) => chamada.fria),
  };
}

export const metricasDoCaso = totaisDoCaso;
