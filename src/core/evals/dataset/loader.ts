import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Caso, Categoria, Modo, Slot } from "../types.js";

export class DatasetError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DatasetError";
  }
}

const CATEGORIAS: Categoria[] = [
  "accuracy",
  "casos_de_borda",
  "relevance",
  "robustness",
];
const MODOS: Modo[] = ["projeto", "algoritmo"];
const SLOTS: Slot[] = [
  "nucleo",
  "entradas",
  "processamento",
  "saidas",
  "criterios",
];

export const DATASET_FILES = {
  accuracy: "accuracy.jsonl",
  casos_de_borda: "edgecases.jsonl",
  relevance: "relevance.jsonl",
  robustness: "robustness.jsonl",
} as const;

export function datasetDir(): string {
  return fileURLToPath(new URL(".", import.meta.url));
}

export async function carregarArquivo(caminho: string): Promise<Caso[]> {
  let texto: string;

  try {
    texto = await readFile(caminho, "utf8");
  } catch (error) {
    throw new DatasetError(
      `Não foi possível ler o dataset ${basename(caminho)}.`,
      { cause: error },
    );
  }

  return carregarLinhas(texto, caminho);
}

export function carregarLinhas(texto: string, arquivo: string): Caso[] {
  const casos: Caso[] = [];
  const ids = new Set<string>();
  const linhas = texto.split(/\r?\n/);

  for (let indice = 0; indice < linhas.length; indice += 1) {
    const linha = linhas[indice].trim();
    const numero = indice + 1;

    if (linha.length === 0) continue;

    let bruto: unknown;

    try {
      bruto = JSON.parse(linha);
    } catch (error) {
      throw erro(arquivo, numero, "JSON inválido.", error);
    }

    const caso = validarCaso(bruto, arquivo, numero);

    if (ids.has(caso.id)) {
      throw erro(arquivo, numero, `id duplicado "${caso.id}".`);
    }

    ids.add(caso.id);
    casos.push(caso);
  }

  return casos;
}

export async function carregarDataset(
  diretorio: string = datasetDir(),
): Promise<Caso[]> {
  const casos: Caso[] = [];
  const origens = new Map<string, string>();

  for (const arquivo of Object.values(DATASET_FILES)) {
    const doArquivo = await carregarArquivo(join(diretorio, arquivo));

    for (const caso of doArquivo) {
      const origem = origens.get(caso.id);

      if (origem) {
        throw new DatasetError(
          `id duplicado "${caso.id}" entre ${origem} e ${arquivo}.`,
        );
      }

      origens.set(caso.id, arquivo);
      casos.push(caso);
    }
  }

  return casos;
}

function erro(
  arquivo: string,
  linha: number,
  mensagem: string,
  cause?: unknown,
): DatasetError {
  return new DatasetError(
    `${basename(arquivo)}:${linha}: ${mensagem}`,
    cause === undefined ? undefined : { cause },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function texto(value: unknown): value is string {
  return typeof value === "string";
}

function textoPreenchido(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function listaDeTextos(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => texto(item));
}

function validarCaso(
  bruto: unknown,
  arquivo: string,
  linha: number,
): Caso {
  if (!isRecord(bruto)) {
    throw erro(arquivo, linha, "o caso precisa ser um objeto JSON.");
  }

  if (!textoPreenchido(bruto.id)) {
    throw erro(arquivo, linha, 'campo obrigatório "id" ausente ou vazio.');
  }

  if (!CATEGORIAS.includes(bruto.categoria as Categoria)) {
    throw erro(
      arquivo,
      linha,
      `campo "categoria" inválido. Use: ${CATEGORIAS.join(", ")}.`,
    );
  }

  if (!MODOS.includes(bruto.modo as Modo)) {
    throw erro(arquivo, linha, 'campo "modo" deve ser "projeto" ou "algoritmo".');
  }

  if (!textoPreenchido(bruto.fase)) {
    throw erro(arquivo, linha, 'campo obrigatório "fase" ausente ou vazio.');
  }

  if (!listaDeTextos(bruto.roteiro)) {
    throw erro(arquivo, linha, 'campo "roteiro" deve ser uma lista de textos.');
  }

  if (bruto.obs !== undefined && !texto(bruto.obs)) {
    throw erro(arquivo, linha, 'campo "obs" deve ser texto.');
  }

  const base = {
    id: bruto.id,
    modo: bruto.modo as Modo,
    fase: bruto.fase,
    roteiro: bruto.roteiro,
    ...(bruto.obs === undefined ? {} : { obs: bruto.obs }),
  };

  switch (bruto.categoria) {
    case "accuracy":
      return {
        ...base,
        categoria: "accuracy",
        esperado: validarAccuracy(bruto.esperado, bruto.modo as Modo, arquivo, linha),
      };
    case "casos_de_borda":
      return {
        ...base,
        categoria: "casos_de_borda",
        spec: validarSpec(bruto.spec, arquivo, linha),
        lacunas: validarLacunas(bruto.lacunas, arquivo, linha),
        minLacunas: validarMinLacunas(bruto.minLacunas, arquivo, linha),
        proibidoAssumir: validarLista(
          bruto.proibidoAssumir,
          "proibidoAssumir",
          arquivo,
          linha,
        ),
      };
    case "relevance":
      return {
        ...base,
        categoria: "relevance",
        slotPendente: validarSlot(bruto.slotPendente, arquivo, linha),
      };
    case "robustness":
      return {
        ...base,
        categoria: "robustness",
        esperado: validarRobustness(bruto.esperado, arquivo, linha),
      };
  }

  throw erro(arquivo, linha, "categoria desconhecida.");
}

function validarLista(
  value: unknown,
  campo: string,
  arquivo: string,
  linha: number,
): string[] {
  if (!listaDeTextos(value)) {
    throw erro(arquivo, linha, `campo "${campo}" deve ser uma lista de textos.`);
  }

  return value;
}

function validarSpec(
  value: unknown,
  arquivo: string,
  linha: number,
): string {
  if (!textoPreenchido(value)) {
    throw erro(arquivo, linha, 'campo obrigatório "spec" ausente ou vazio.');
  }

  return value;
}

function validarMinLacunas(
  value: unknown,
  arquivo: string,
  linha: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw erro(arquivo, linha, 'campo "minLacunas" deve ser um número não negativo.');
  }

  return value;
}

function validarSlot(
  value: unknown,
  arquivo: string,
  linha: number,
): Slot {
  if (!SLOTS.includes(value as Slot)) {
    throw erro(
      arquivo,
      linha,
      `campo "slotPendente" inválido. Use: ${SLOTS.join(", ")}.`,
    );
  }

  return value as Slot;
}

function validarAccuracy(
  value: unknown,
  modo: Modo,
  arquivo: string,
  linha: number,
): CasoAccuracyEsperado {
  if (!isRecord(value)) {
    throw erro(arquivo, linha, 'campo obrigatório "esperado" ausente.');
  }

  const projetoMd = value.projetoMd;
  const algoritmoMd = value.algoritmoMd;

  if (modo === "projeto" && projetoMd === undefined) {
    throw erro(arquivo, linha, 'caso de projeto exige "esperado.projetoMd".');
  }

  if (modo === "algoritmo" && algoritmoMd === undefined) {
    throw erro(arquivo, linha, 'caso de algoritmo exige "esperado.algoritmoMd".');
  }

  if (projetoMd !== undefined) {
    validarMapaDeListas(projetoMd, "esperado.projetoMd", arquivo, linha);
  }

  if (algoritmoMd !== undefined) {
    validarMapaDeListas(algoritmoMd, "esperado.algoritmoMd", arquivo, linha);
  }

  if (!isRecord(value.session)) {
    throw erro(arquivo, linha, 'campo "esperado.session" deve ser um objeto.');
  }

  if (!MODOS.includes(value.session.modo as Modo)) {
    throw erro(
      arquivo,
      linha,
      'campo "esperado.session.modo" deve ser "projeto" ou "algoritmo".',
    );
  }

  if (!textoPreenchido(value.session.fase)) {
    throw erro(arquivo, linha, 'campo "esperado.session.fase" ausente ou vazio.');
  }

  return {
    ...(projetoMd === undefined ? {} : { projetoMd: projetoMd as Record<string, string[]> }),
    ...(algoritmoMd === undefined
      ? {}
      : { algoritmoMd: algoritmoMd as Record<string, string[]> }),
    naoDeveConter: validarLista(
      value.naoDeveConter,
      "esperado.naoDeveConter",
      arquivo,
      linha,
    ),
    session: {
      modo: value.session.modo as Modo,
      fase: value.session.fase,
    },
    aprovacoes: validarLista(
      value.aprovacoes,
      "esperado.aprovacoes",
      arquivo,
      linha,
    ),
  };
}

type CasoAccuracyEsperado = Extract<Caso, { categoria: "accuracy" }>["esperado"];

function validarMapaDeListas(
  value: unknown,
  campo: string,
  arquivo: string,
  linha: number,
): void {
  if (!isRecord(value)) {
    throw erro(arquivo, linha, `campo "${campo}" deve ser um objeto.`);
  }

  for (const [chave, itens] of Object.entries(value)) {
    if (!listaDeTextos(itens)) {
      throw erro(
        arquivo,
        linha,
        `campo "${campo}.${chave}" deve ser uma lista de textos.`,
      );
    }
  }
}

function validarLacunas(
  value: unknown,
  arquivo: string,
  linha: number,
): CasoBordaLacuna[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw erro(arquivo, linha, 'campo "lacunas" deve ser uma lista não vazia.');
  }

  return value.map((item, indice) => {
    if (!isRecord(item)) {
      throw erro(arquivo, linha, `lacuna ${indice + 1} deve ser um objeto.`);
    }

    if (!textoPreenchido(item.id)) {
      throw erro(arquivo, linha, `lacuna ${indice + 1} sem "id".`);
    }

    if (!textoPreenchido(item.descricao)) {
      throw erro(arquivo, linha, `lacuna ${indice + 1} sem "descricao".`);
    }

    return {
      id: item.id,
      descricao: item.descricao,
      termos: validarLista(
        item.termos,
        `lacunas[${indice}].termos`,
        arquivo,
        linha,
      ),
    };
  });
}

type CasoBordaLacuna = Extract<Caso, { categoria: "casos_de_borda" }>["lacunas"][number];

function validarRobustness(
  value: unknown,
  arquivo: string,
  linha: number,
): CasoRobustnessEsperado {
  if (!isRecord(value)) {
    throw erro(arquivo, linha, 'campo obrigatório "esperado" ausente.');
  }

  if (value.semCodigo !== undefined && typeof value.semCodigo !== "boolean") {
    throw erro(arquivo, linha, 'campo "esperado.semCodigo" deve ser booleano.');
  }

  if (
    value.maxPerguntas !== undefined &&
    (typeof value.maxPerguntas !== "number" ||
      !Number.isInteger(value.maxPerguntas) ||
      value.maxPerguntas < 0)
  ) {
    throw erro(
      arquivo,
      linha,
      'campo "esperado.maxPerguntas" deve ser um inteiro não negativo.',
    );
  }

  if (value.faseFinal !== undefined && !textoPreenchido(value.faseFinal)) {
    throw erro(arquivo, linha, 'campo "esperado.faseFinal" deve ser texto não vazio.');
  }

  if (value.modoFinal !== undefined && !MODOS.includes(value.modoFinal as Modo)) {
    throw erro(
      arquivo,
      linha,
      'campo "esperado.modoFinal" deve ser "projeto" ou "algoritmo".',
    );
  }

  return {
    ...(value.semCodigo === undefined ? {} : { semCodigo: value.semCodigo }),
    ...(value.maxPerguntas === undefined
      ? {}
      : { maxPerguntas: value.maxPerguntas }),
    ...(value.faseFinal === undefined ? {} : { faseFinal: value.faseFinal }),
    ...(value.modoFinal === undefined
      ? {}
      : { modoFinal: value.modoFinal as Modo }),
  };
}

type CasoRobustnessEsperado = Extract<
  Caso,
  { categoria: "robustness" }
>["esperado"];
