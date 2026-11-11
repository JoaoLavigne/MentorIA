import type { ChamadaLLM } from "../types.js";

const CAMPOS_CHAMADAS = ["llmCalls", "llm_calls", "chamadas", "calls"];

const CAMPOS_MODELO = ["modelo", "model", "modelName", "model_name"];
const CAMPOS_FASE = ["fase", "phase"];

const CAMPOS_TOKENS_ENTRADA = [
  "tokensEntrada",
  "tokens_entrada",
  "promptEvalCount",
  "prompt_eval_count",
  "inputTokens",
  "input_tokens",
  "promptTokens",
  "prompt_tokens",
];

const CAMPOS_TOKENS_SAIDA = [
  "tokensSaida",
  "tokens_saida",
  "evalCount",
  "eval_count",
  "outputTokens",
  "output_tokens",
  "completionTokens",
  "completion_tokens",
];

const CAMPOS_METADADOS = ["usageMetadata", "usage_metadata"];
const CAMPOS_METADADOS_ENTRADA = [
  "promptTokenCount",
  "prompt_token_count",
  "inputTokens",
  "input_tokens",
];
const CAMPOS_METADADOS_SAIDA = [
  "candidatesTokenCount",
  "candidates_token_count",
  "outputTokens",
  "output_tokens",
];

const CAMPOS_TEMPO_MS = [
  "tempoMs",
  "tempo_ms",
  "latencyMs",
  "latency_ms",
  "durationMs",
  "duration_ms",
  "tempo",
  "latency",
  "total_duration_ms",
  "totalDurationMs",
];

const CAMPOS_TEMPO_NS = [
  "total_duration",
  "totalDuration",
  "duracaoTotal",
  "duracao_total",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function primeiro(
  registro: Record<string, unknown>,
  chaves: string[],
): unknown {
  for (const chave of chaves) {
    if (chave in registro) return registro[chave];
  }

  return undefined;
}

function numero(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const convertido = Number(value);

    return Number.isFinite(convertido) && convertido >= 0
      ? convertido
      : undefined;
  }

  return undefined;
}

function texto(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const limpo = value.trim();
  return limpo === "" ? undefined : limpo;
}

function tempoMs(registro: Record<string, unknown>): number {
  const direto = numero(primeiro(registro, CAMPOS_TEMPO_MS));
  if (direto !== undefined) return direto;

  const nanossegundos = numero(primeiro(registro, CAMPOS_TEMPO_NS));
  if (nanossegundos !== undefined) return nanossegundos / 1_000_000;

  return 0;
}

function comoSessao(sessao: unknown): unknown {
  if (typeof sessao !== "string") return sessao;

  try {
    return JSON.parse(sessao) as unknown;
  } catch {
    return null;
  }
}

function tokens(
  registro: Record<string, unknown>,
  campos: string[],
  camposMetadados: string[],
): number {
  const direto = numero(primeiro(registro, campos));
  if (direto !== undefined) return direto;

  const metadados = primeiro(registro, CAMPOS_METADADOS);
  if (!isRecord(metadados)) return 0;

  return numero(primeiro(metadados, camposMetadados)) ?? 0;
}

export function extrairChamada(raw: unknown): ChamadaLLM | null {
  if (!isRecord(raw)) return null;

  return {
    modelo: texto(primeiro(raw, CAMPOS_MODELO)) ?? "desconhecido",
    fase: texto(primeiro(raw, CAMPOS_FASE)) ?? "desconhecida",
    tokensEntrada: tokens(raw, CAMPOS_TOKENS_ENTRADA, CAMPOS_METADADOS_ENTRADA),
    tokensSaida: tokens(raw, CAMPOS_TOKENS_SAIDA, CAMPOS_METADADOS_SAIDA),
    tempoMs: tempoMs(raw),
    fria: false,
  };
}

export function extrairChamadas(sessao: unknown): ChamadaLLM[] {
  const objeto = comoSessao(sessao);
  if (!isRecord(objeto)) return [];

  const lista = primeiro(objeto, CAMPOS_CHAMADAS);
  if (!Array.isArray(lista)) return [];

  const vistos = new Set<string>();
  const chamadas: ChamadaLLM[] = [];

  for (const item of lista) {
    const chamada = extrairChamada(item);
    if (!chamada) continue;

    chamada.fria = !vistos.has(chamada.modelo);
    vistos.add(chamada.modelo);
    chamadas.push(chamada);
  }

  return chamadas;
}

export const extrairChamadasLLM = extrairChamadas;
export const extrairDaRespostaOllama = extrairChamada;
