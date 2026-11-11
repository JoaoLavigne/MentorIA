import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  agregar,
  totaisDoCaso,
} from "../evaluators/cost-latency/metrics.js";
import type {
  Categoria,
  ChamadaLLM,
  ResultadoCaso,
} from "../types.js";

export class RelatorioError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RelatorioError";
  }
}

export type RelatorioOptions = {
  dirSaida?: string;
  titulo?: string;
};

export type RelatorioGerado = {
  resultados: ResultadoCaso[];
  markdown: string;
  csv: string;
  arquivoMd: string;
  arquivoCsv: string;
};

const NOMES_CATEGORIA: Record<Categoria, string> = {
  accuracy: "Accuracy",
  casos_de_borda: "Casos de borda",
  relevance: "Relevance",
  robustness: "Robustness",
};

const ORDEM_CATEGORIAS: Categoria[] = [
  "accuracy",
  "casos_de_borda",
  "relevance",
  "robustness",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validarResultado(value: unknown, linha: number): ResultadoCaso {
  if (!isRecord(value)) {
    throw new RelatorioError(`Linha ${linha}: resultado não é um objeto JSON.`);
  }

  if (typeof value.casoId !== "string" || value.casoId === "") {
    throw new RelatorioError(`Linha ${linha}: "casoId" ausente.`);
  }

  if (typeof value.modelo !== "string") {
    throw new RelatorioError(`Linha ${linha}: "modelo" ausente.`);
  }

  if (value.nota !== 0 && value.nota !== 1 && value.nota !== 2) {
    throw new RelatorioError(`Linha ${linha}: "nota" deve ser 0, 1 ou 2.`);
  }

  return value as unknown as ResultadoCaso;
}

export async function lerResultados(caminho: string): Promise<ResultadoCaso[]> {
  let texto: string;

  try {
    texto = await readFile(caminho, "utf8");
  } catch (error) {
    throw new RelatorioError(
      `Não foi possível ler os resultados em ${caminho}.`,
      { cause: error },
    );
  }

  const resultados: ResultadoCaso[] = [];
  const linhas = texto.split(/\r?\n/);

  for (let indice = 0; indice < linhas.length; indice += 1) {
    const linha = linhas[indice]!.trim();
    if (linha.length === 0) continue;

    let bruto: unknown;
    try {
      bruto = JSON.parse(linha);
    } catch (error) {
      throw new RelatorioError(
        `Linha ${indice + 1}: JSON inválido.`,
        { cause: error },
      );
    }

    resultados.push(validarResultado(bruto, indice + 1));
  }

  return resultados;
}

function modelos(resultados: ResultadoCaso[]): string[] {
  return [...new Set(resultados.map((resultado) => resultado.modelo))];
}

function score(resultados: ResultadoCaso[]): number | null {
  if (resultados.length === 0) return null;

  const soma = resultados.reduce(
    (total, resultado) => total + resultado.nota,
    0,
  );

  return (soma / (2 * resultados.length)) * 100;
}

function formatarScore(valor: number | null): string {
  return valor === null ? "n/a" : `${valor.toFixed(1)}%`;
}

function formatarMs(valor: number | null): string {
  return valor === null ? "n/a" : `${valor.toFixed(1)} ms`;
}

function tabela(cabecalhos: string[], linhas: string[][]): string {
  const head = `| ${cabecalhos.join(" | ")} |`;
  const separador = `| ${cabecalhos.map(() => "---").join(" | ")} |`;
  const corpo = linhas.map((linha) => `| ${linha.join(" | ")} |`);

  return [head, separador, ...corpo].join("\n");
}

function tabelaScore(resultados: ResultadoCaso[]): string {
  const listaModelos = modelos(resultados);
  const cabecalhos = ["Categoria", ...listaModelos];
  const linhas: string[][] = [];

  for (const categoria of ORDEM_CATEGORIAS) {
    const daCategoria = resultados.filter(
      (resultado) => resultado.categoria === categoria,
    );

    linhas.push([
      NOMES_CATEGORIA[categoria],
      ...listaModelos.map((modelo) =>
        formatarScore(
          score(daCategoria.filter((resultado) => resultado.modelo === modelo)),
        ),
      ),
    ]);
  }

  linhas.push([
    "**Total**",
    ...listaModelos.map((modelo) =>
      formatarScore(
        score(resultados.filter((resultado) => resultado.modelo === modelo)),
      ),
    ),
  ]);

  return tabela(cabecalhos, linhas);
}

function secaoCatastroficas(resultados: ResultadoCaso[]): string {
  const falhas = resultados.filter((resultado) => resultado.catastrofica);

  if (falhas.length === 0) {
    return "Nenhuma falha catastrófica.";
  }

  const linhas = falhas.map((resultado) => [
    resultado.casoId,
    NOMES_CATEGORIA[resultado.categoria],
    resultado.modelo,
    String(resultado.repeticao),
    resultado.motivo.replace(/\|/g, "\\|"),
  ]);

  return [
    `Total: **${falhas.length}**.`,
    "",
    tabela(
      ["Caso", "Categoria", "Modelo", "Repetição", "Motivo"],
      linhas,
    ),
  ].join("\n");
}

function chamadasDosResultados(resultados: ResultadoCaso[]): ChamadaLLM[] {
  const chamadas = resultados.flatMap(
    (resultado) => resultado.chamadas ?? [],
  );

  if (chamadas.length > 0) return chamadas;

  return resultados.map((resultado) => ({
    modelo: resultado.modelo,
    fase: "desconhecida",
    tokensEntrada: resultado.metricas.tokensEntrada,
    tokensSaida: resultado.metricas.tokensSaida,
    tempoMs: resultado.metricas.tempoMs,
    fria: resultado.metricas.fria,
  }));
}

function agruparPor(
  chamadas: ChamadaLLM[],
  chave: (chamada: ChamadaLLM) => string,
): Map<string, ChamadaLLM[]> {
  const grupos = new Map<string, ChamadaLLM[]>();

  for (const chamada of chamadas) {
    const grupo = chave(chamada);
    const atuais = grupos.get(grupo) ?? [];
    atuais.push(chamada);
    grupos.set(grupo, atuais);
  }

  return grupos;
}

function tabelaMetricas(
  rotulo: string,
  grupos: Map<string, ChamadaLLM[]>,
): string {
  const linhas: string[][] = [];

  for (const [nome, chamadas] of grupos) {
    const agregado = agregar(chamadas);
    const totais = totaisDoCaso(chamadas);
    const semQuentes = agregado.chamadas === 0;

    linhas.push([
      nome,
      String(totais.chamadas),
      String(totais.tokensEntrada),
      String(totais.tokensSaida),
      formatarMs(semQuentes ? null : agregado.tempoMedioMs),
      formatarMs(semQuentes ? null : agregado.tempoMedianoMs),
      formatarMs(semQuentes ? null : agregado.p95Ms),
    ]);
  }

  return tabela(
    [
      rotulo,
      "Chamadas",
      "Tokens entrada",
      "Tokens saída",
      "Média",
      "Mediana",
      "p95",
    ],
    linhas,
  );
}

function secaoMetricas(resultados: ResultadoCaso[]): string {
  const chamadas = chamadasDosResultados(resultados);

  return [
    tabelaMetricas("Modelo", agruparPor(chamadas, (chamada) => chamada.modelo)),
    "",
    tabelaMetricas("Fase", agruparPor(chamadas, (chamada) => chamada.fase)),
    "",
    "Latências excluem chamadas frias; tokens somam todas as chamadas.",
  ].join("\n");
}

export function tabelaParaReadme(resultados: ResultadoCaso[]): string {
  const listaModelos = modelos(resultados);
  const linhas = listaModelos.map((modelo) => {
    const doModelo = resultados.filter(
      (resultado) => resultado.modelo === modelo,
    );
    const chamadas = chamadasDosResultados(doModelo);
    const agregado = agregar(chamadas);
    const catastroficas = doModelo.filter(
      (resultado) => resultado.catastrofica,
    ).length;

    return [
      `\`${modelo}\``,
      formatarScore(score(doModelo)),
      ...ORDEM_CATEGORIAS.map((categoria) =>
        formatarScore(
          score(doModelo.filter((resultado) => resultado.categoria === categoria)),
        ),
      ),
      String(catastroficas),
      formatarMs(agregado.chamadas === 0 ? null : agregado.p95Ms),
    ];
  });

  return tabela(
    [
      "Modelo",
      "Score total",
      ...ORDEM_CATEGORIAS.map((categoria) => NOMES_CATEGORIA[categoria]),
      "Catastróficas",
      "p95",
    ],
    linhas,
  );
}

export function gerarMarkdown(
  resultados: ResultadoCaso[],
  options: RelatorioOptions = {},
): string {
  const titulo = options.titulo ?? "Relatório de Evals";

  return [
    `# ${titulo}`,
    "",
    `Casos avaliados: **${resultados.length}**.`,
    "",
    "## Score por categoria e modelo",
    "",
    tabelaScore(resultados),
    "",
    "## Falhas catastróficas",
    "",
    secaoCatastroficas(resultados),
    "",
    "## Custo e latência",
    "",
    secaoMetricas(resultados),
    "",
    "## Tabela para o README",
    "",
    tabelaParaReadme(resultados),
    "",
  ].join("\n");
}

function csvCampo(valor: string): string {
  if (!/[",\n\r]/.test(valor)) return valor;

  return `"${valor.replace(/"/g, '""')}"`;
}

export function gerarCsv(resultados: ResultadoCaso[]): string {
  const cabecalho = [
    "casoId",
    "categoria",
    "modelo",
    "repeticao",
    "nota",
    "catastrofica",
    "motivo",
    "tokensEntrada",
    "tokensSaida",
    "tempoMs",
    "fria",
  ];

  const linhas = resultados.map((resultado) =>
    [
      resultado.casoId,
      resultado.categoria,
      resultado.modelo,
      String(resultado.repeticao),
      String(resultado.nota),
      String(resultado.catastrofica),
      resultado.motivo,
      String(resultado.metricas.tokensEntrada),
      String(resultado.metricas.tokensSaida),
      String(resultado.metricas.tempoMs),
      String(resultado.metricas.fria),
    ]
      .map(csvCampo)
      .join(","),
  );

  return `${[cabecalho.join(","), ...linhas].join("\n")}\n`;
}

export async function gerarRelatorio(
  caminhoResultados: string,
  options: RelatorioOptions = {},
): Promise<RelatorioGerado> {
  const resultados = await lerResultados(caminhoResultados);
  const markdown = gerarMarkdown(resultados, options);
  const csv = gerarCsv(resultados);
  const dirSaida = options.dirSaida ?? dirname(caminhoResultados);

  const arquivoMd = join(dirSaida, "relatorio.md");
  const arquivoCsv = join(dirSaida, "relatorio.csv");

  await writeFile(arquivoMd, markdown, "utf8");
  await writeFile(arquivoCsv, csv, "utf8");

  return { resultados, markdown, csv, arquivoMd, arquivoCsv };
}

export function nomeDaRodada(caminhoResultados: string): string {
  return basename(dirname(caminhoResultados));
}
