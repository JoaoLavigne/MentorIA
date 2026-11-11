import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { carregarDataset } from "../dataset/loader.js";
import { accuracyEvaluator } from "../evaluators/accuracy/accuracy.js";
import { totaisDoCaso } from "../evaluators/cost-latency/metrics.js";
import { edgecasesEvaluator } from "../evaluators/edgecases/edgecases.js";
import { relevanceEvaluator } from "../evaluators/relevance/relevance.js";
import { robustnessEvaluator } from "../evaluators/robustness/robustness.js";
import type {
  Caso,
  Categoria,
  ChamadaLLM,
  ResultadoAvaliacao,
  ResultadoCaso,
  SaidaColetada,
} from "../types.js";
import {
  EngineAgentAdapter,
  type AgentAdapter,
} from "./agentAdapter.js";
import {
  criarSandbox,
  gravarEstadoInicial,
  limparSandbox,
} from "./sandbox.js";
import { executarRoteiro } from "./studentScript.js";
import { extrairChamadas } from "./telemetry.js";

export class RunnerError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RunnerError";
  }
}

export const RESULTS_DIR = fileURLToPath(new URL("../results/", import.meta.url));

export const CATEGORIAS: Categoria[] = [
  "accuracy",
  "casos_de_borda",
  "relevance",
  "robustness",
];

const MODELO_PADRAO = "llama3.2:3b";

export type AdapterFactory = (
  caso: Caso,
  modelo: string,
  repeticao: number,
) => AgentAdapter;

export type RunnerOptions = {
  modelos?: string[];
  categorias?: Categoria[];
  casos?: string[];
  repeticoes?: number;
  keep?: boolean;
  rodadaId?: string;
  dataset?: Caso[];
  sandboxRoot?: string;
  resultsDir?: string;
  adapterFactory?: AdapterFactory;
  onResultado?: (
    resultado: ResultadoCaso,
    indice: number,
    total: number,
  ) => void;
};

export type ResultadoRodada = {
  rodadaId: string;
  arquivo: string;
  resultados: ResultadoCaso[];
};

function isCategoria(valor: string): valor is Categoria {
  return CATEGORIAS.includes(valor as Categoria);
}

function mensagem(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function rodadaIdPadrao(data = new Date()): string {
  return data.toISOString().replace(/[:.]/g, "-");
}

function slug(valor: string): string {
  const limpo = valor
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return limpo === "" ? "modelo" : limpo;
}

function idSandbox(caso: Caso, modelo: string, repeticao: number): string {
  return `${caso.id}--${slug(modelo)}--r${repeticao}`;
}

function avaliar(caso: Caso, saida: SaidaColetada): ResultadoAvaliacao {
  switch (caso.categoria) {
    case "accuracy":
      return accuracyEvaluator.avaliar(caso, saida);
    case "casos_de_borda":
      return edgecasesEvaluator.avaliar(caso, saida);
    case "relevance":
      return relevanceEvaluator.avaliar(caso, saida);
    case "robustness":
      return robustnessEvaluator.avaliar(caso, saida);
  }
}

function resultadoErro(
  caso: Caso,
  modelo: string,
  repeticao: number,
  erro: string,
  chamadas: ChamadaLLM[],
): ResultadoCaso {
  const metricas = totaisDoCaso(chamadas);

  return {
    casoId: caso.id,
    categoria: caso.categoria,
    modelo,
    repeticao,
    nota: 0,
    catastrofica: false,
    motivo: `erro de execução: ${erro}`,
    metricas: {
      tokensEntrada: metricas.tokensEntrada,
      tokensSaida: metricas.tokensSaida,
      tempoMs: metricas.tempoMs,
      fria: metricas.fria,
    },
    chamadas,
  };
}

function resultadoCaso(
  caso: Caso,
  modelo: string,
  repeticao: number,
  avaliacao: ResultadoAvaliacao,
  chamadas: ChamadaLLM[],
): ResultadoCaso {
  const metricas = totaisDoCaso(chamadas);

  return {
    casoId: caso.id,
    categoria: caso.categoria,
    modelo,
    repeticao,
    nota: avaliacao.nota,
    catastrofica: avaliacao.catastrofica,
    motivo: avaliacao.motivo,
    metricas: {
      tokensEntrada: metricas.tokensEntrada,
      tokensSaida: metricas.tokensSaida,
      tempoMs: metricas.tempoMs,
      fria: metricas.fria,
    },
    chamadas,
  };
}

function filtrarCasos(dataset: Caso[], options: RunnerOptions): Caso[] {
  const categorias = new Set(options.categorias ?? []);
  const ids = new Set(options.casos ?? []);

  const casos = dataset.filter(
    (caso) =>
      (categorias.size === 0 || categorias.has(caso.categoria)) &&
      (ids.size === 0 || ids.has(caso.id)),
  );

  if (casos.length === 0) {
    throw new RunnerError(
      "Nenhum caso do dataset corresponde aos filtros informados.",
    );
  }

  return casos;
}

function marcarFrias(
  chamadas: ChamadaLLM[],
  modelosVistos: Set<string>,
): ChamadaLLM[] {
  for (const chamada of chamadas) {
    chamada.fria = !modelosVistos.has(chamada.modelo);
    modelosVistos.add(chamada.modelo);
  }

  return chamadas;
}

export async function executarRodada(
  options: RunnerOptions = {},
): Promise<ResultadoRodada> {
  const repeticoes = options.repeticoes ?? 1;

  if (!Number.isInteger(repeticoes) || repeticoes < 1) {
    throw new RunnerError("O número de repetições deve ser um inteiro positivo.");
  }

  const modelos =
    options.modelos && options.modelos.length > 0
      ? options.modelos
      : [MODELO_PADRAO];
  const dataset = options.dataset ?? (await carregarDataset());
  const casos = filtrarCasos(dataset, options);
  const rodadaId = options.rodadaId ?? rodadaIdPadrao();
  const resultsDir = options.resultsDir ?? RESULTS_DIR;
  const pastaRodada = join(resultsDir, rodadaId);
  const arquivo = join(pastaRodada, "resultados.jsonl");
  const adapterFactory =
    options.adapterFactory ?? (() => new EngineAgentAdapter());

  await mkdir(pastaRodada, { recursive: true });
  await writeFile(arquivo, "", "utf8");

  const resultados: ResultadoCaso[] = [];
  const modelosVistos = new Set<string>();
  const totalExecucoes = modelos.length * casos.length * repeticoes;

  for (const modelo of modelos) {
    for (const caso of casos) {
      for (let repeticao = 1; repeticao <= repeticoes; repeticao += 1) {
        let resultado: ResultadoCaso;
        let chamadas: ChamadaLLM[] = [];
        const nomeSandbox = idSandbox(caso, modelo, repeticao);
        let sandbox: string | undefined;

        try {
          sandbox = await criarSandbox(rodadaId, nomeSandbox, {
            raiz: options.sandboxRoot,
          });
          await gravarEstadoInicial(sandbox, caso);

          const adapter = adapterFactory(caso, modelo, repeticao);
          const execucao = await executarRoteiro(adapter, caso, {
            pastaProjeto: sandbox,
            modelo,
          });
          chamadas = marcarFrias(
            extrairChamadas(execucao.saida.session),
            modelosVistos,
          );

          resultado =
            execucao.erro === undefined
              ? resultadoCaso(
                  caso,
                  modelo,
                  repeticao,
                  avaliar(caso, execucao.saida),
                  chamadas,
                )
              : resultadoErro(
                  caso,
                  modelo,
                  repeticao,
                  execucao.erro,
                  chamadas,
                );
        } catch (error) {
          resultado = resultadoErro(
            caso,
            modelo,
            repeticao,
            mensagem(error),
            chamadas,
          );
        } finally {
          if (sandbox !== undefined) {
            await limparSandbox(sandbox, {
              raiz: options.sandboxRoot,
              keep: options.keep,
            }).catch(() => undefined);
          }
        }

        resultados.push(resultado);
        await appendFile(arquivo, `${JSON.stringify(resultado)}\n`, "utf8");
        options.onResultado?.(
          resultado,
          resultados.length,
          totalExecucoes,
        );
      }
    }
  }

  return { rodadaId, arquivo, resultados };
}

export const runEvals = executarRodada;

function valorObrigatorio(argv: string[], indice: number, opcao: string): string {
  const valor = argv[indice + 1];

  if (valor === undefined || valor.startsWith("--")) {
    throw new RunnerError(`A opção ${opcao} exige um valor.`);
  }

  return valor;
}

export function parseRunnerArgs(argv: string[]): RunnerOptions {
  const options: RunnerOptions = {
    modelos: [],
    categorias: [],
    casos: [],
  };

  for (let indice = 0; indice < argv.length; indice += 1) {
    const argumento = argv[indice]!;

    switch (argumento) {
      case "--categoria": {
        const valor = valorObrigatorio(argv, indice, argumento);
        indice += 1;

        if (!isCategoria(valor)) {
          throw new RunnerError(
            `Categoria inválida "${valor}". Use: ${CATEGORIAS.join(", ")}.`,
          );
        }

        options.categorias!.push(valor);
        break;
      }
      case "--modelo": {
        const valor = valorObrigatorio(argv, indice, argumento);
        indice += 1;
        options.modelos!.push(valor);
        break;
      }
      case "--caso": {
        const valor = valorObrigatorio(argv, indice, argumento);
        indice += 1;
        options.casos!.push(valor);
        break;
      }
      case "--repeticoes": {
        const valor = valorObrigatorio(argv, indice, argumento);
        indice += 1;

        const repeticoes = Number(valor);
        if (!Number.isInteger(repeticoes) || repeticoes < 1) {
          throw new RunnerError(
            "A opção --repeticoes exige um inteiro positivo.",
          );
        }

        options.repeticoes = repeticoes;
        break;
      }
      case "--keep": {
        options.keep = true;
        break;
      }
      case "--rodada": {
        const valor = valorObrigatorio(argv, indice, argumento);
        indice += 1;
        options.rodadaId = valor;
        break;
      }
      default:
        throw new RunnerError(`Opção desconhecida: ${argumento}.`);
    }
  }

  return options;
}
