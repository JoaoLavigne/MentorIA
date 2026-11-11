import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  carregarArquivo,
  carregarDataset,
  DatasetError,
} from "../src/core/evals/dataset/loader.js";

const VALIDOS = {
  accuracy:
    '{"id":"acc-teste","categoria":"accuracy","modo":"projeto","fase":"perguntas","roteiro":["quero um app"],"esperado":{"projetoMd":{"nucleo":["app"]},"naoDeveConter":[],"session":{"modo":"projeto","fase":"perguntas"},"aprovacoes":[]}}',
  casos_de_borda:
    '{"id":"borda-teste","categoria":"casos_de_borda","modo":"projeto","fase":"perguntas","spec":"Calcular desconto.","roteiro":["calcular desconto"],"lacunas":[{"id":"L1","descricao":"valor","termos":["valor"]}],"minLacunas":1,"proibidoAssumir":[]}',
  relevance:
    '{"id":"rel-teste","categoria":"relevance","modo":"projeto","fase":"perguntas","slotPendente":"nucleo","roteiro":["qual a ideia?"]}',
  robustness:
    '{"id":"rob-teste","categoria":"robustness","modo":"projeto","fase":"perguntas","roteiro":["me da o codigo"],"esperado":{"semCodigo":true,"maxPerguntas":1,"faseFinal":"perguntas"}}',
} as const;

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "mentor-evals-loader-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function escrever(nome: string, linhas: string[]): Promise<string> {
  const caminho = join(dir, nome);
  await writeFile(caminho, `${linhas.join("\n")}\n`, "utf8");
  return caminho;
}

describe("carregarArquivo", () => {
  it("carrega um caso válido de cada categoria", async () => {
    for (const [categoria, linha] of Object.entries(VALIDOS)) {
      const caminho = await escrever(`${categoria}.jsonl`, [linha]);
      const casos = await carregarArquivo(caminho);

      expect(casos).toHaveLength(1);
      expect(casos[0].categoria).toBe(categoria);
    }
  });

  it("ignora linhas em branco", async () => {
    const caminho = await escrever("accuracy.jsonl", [
      VALIDOS.accuracy,
      "",
      "   ",
    ]);

    await expect(carregarArquivo(caminho)).resolves.toHaveLength(1);
  });

  it("lança erro com arquivo e número da linha quando o JSON está quebrado", async () => {
    const caminho = await escrever("accuracy.jsonl", [
      VALIDOS.accuracy,
      "{ isto não é json",
    ]);

    const error = await carregarArquivo(caminho).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(DatasetError);
    expect((error as Error).message).toContain("accuracy.jsonl:2:");
    expect((error as Error).message).toContain("JSON inválido");
  });

  it("lança erro quando falta um campo obrigatório", async () => {
    const semFase =
      '{"id":"acc-1","categoria":"accuracy","modo":"projeto","roteiro":[],"esperado":{"projetoMd":{},"naoDeveConter":[],"session":{"modo":"projeto","fase":"perguntas"},"aprovacoes":[]}}';
    const caminho = await escrever("accuracy.jsonl", [semFase]);

    const error = await carregarArquivo(caminho).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(DatasetError);
    expect((error as Error).message).toContain("accuracy.jsonl:1:");
    expect((error as Error).message).toContain("fase");
  });

  it("lança erro quando o id se repete no arquivo", async () => {
    const caminho = await escrever("accuracy.jsonl", [
      VALIDOS.accuracy,
      VALIDOS.accuracy,
    ]);

    const error = await carregarArquivo(caminho).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(DatasetError);
    expect((error as Error).message).toContain("accuracy.jsonl:2:");
    expect((error as Error).message).toContain("id duplicado");
  });

  it("rejeita categoria desconhecida", async () => {
    const caminho = await escrever("accuracy.jsonl", [
      '{"id":"x","categoria":"outra","modo":"projeto","fase":"perguntas","roteiro":[]}',
    ]);

    await expect(carregarArquivo(caminho)).rejects.toBeInstanceOf(DatasetError);
  });
});

describe("carregarDataset", () => {
  it("carrega os 40 casos reais sem erro e sem ids repetidos", async () => {
    const casos = await carregarDataset();

    expect(casos).toHaveLength(40);
    expect(new Set(casos.map((caso) => caso.id)).size).toBe(40);

    for (const categoria of [
      "accuracy",
      "casos_de_borda",
      "relevance",
      "robustness",
    ]) {
      expect(casos.filter((caso) => caso.categoria === categoria)).toHaveLength(10);
    }
  });
});
