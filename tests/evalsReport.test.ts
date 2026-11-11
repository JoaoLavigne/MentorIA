import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  gerarCsv,
  gerarMarkdown,
  gerarRelatorio,
  lerResultados,
  RelatorioError,
  tabelaParaReadme,
} from "../src/core/evals/report/report.js";
import type { ChamadaLLM, ResultadoCaso } from "../src/core/evals/types.js";

let dir: string;

function resultado(extras: Partial<ResultadoCaso> = {}): ResultadoCaso {
  return {
    casoId: "caso-1",
    categoria: "accuracy",
    modelo: "m1",
    repeticao: 1,
    nota: 2,
    catastrofica: false,
    motivo: "ok",
    metricas: {
      tokensEntrada: 0,
      tokensSaida: 0,
      tempoMs: 0,
      fria: false,
    },
    ...extras,
  };
}

function chamada(extras: Partial<ChamadaLLM> = {}): ChamadaLLM {
  return {
    modelo: "m1",
    fase: "perguntas",
    tokensEntrada: 0,
    tokensSaida: 0,
    tempoMs: 100,
    fria: false,
    ...extras,
  };
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "mentor-report-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("gerarMarkdown", () => {
  it("calcula Score por categoria, total e mostra n/a", () => {
    const resultados = [
      resultado({ casoId: "acc-1", categoria: "accuracy", nota: 2 }),
      resultado({ casoId: "acc-2", categoria: "accuracy", nota: 1 }),
      resultado({ casoId: "rel-1", categoria: "relevance", nota: 0 }),
    ];

    const markdown = gerarMarkdown(resultados);

    expect(markdown).toContain("| Accuracy | 75.0% |");
    expect(markdown).toContain("| Relevance | 0.0% |");
    expect(markdown).toContain("| Casos de borda | n/a |");
    expect(markdown).toContain("| **Total** | 50.0% |");
  });

  it("separa falhas catastróficas com os ids", () => {
    const resultados = [
      resultado({
        casoId: "acc-9",
        catastrofica: true,
        nota: 0,
        motivo: "falha catastrófica: codigo_sem_aprovacao",
      }),
      resultado({ casoId: "acc-1" }),
    ];

    const markdown = gerarMarkdown(resultados);

    expect(markdown).toContain("Total: **1**.");
    expect(markdown).toContain("acc-9");
    expect(markdown).toContain("codigo_sem_aprovacao");
  });

  it("mostra custo e latência por modelo e por fase", () => {
    const chamadas = [
      chamada({ tempoMs: 100, tokensEntrada: 10, tokensSaida: 5, fria: true }),
      chamada({ tempoMs: 200, tokensEntrada: 20, tokensSaida: 10 }),
      chamada({ fase: "desenho", tempoMs: 500, tokensEntrada: 30, tokensSaida: 15 }),
    ];
    const resultados = [resultado({ chamadas })];

    const markdown = gerarMarkdown(resultados);

    expect(markdown).toContain("## Custo e latência");
    expect(markdown).toContain("| Modelo | Chamadas |");
    expect(markdown).toContain("| Fase | Chamadas |");
    expect(markdown).toContain("350.0 ms");
    expect(markdown).toContain("500.0 ms");
    expect(markdown).toContain("Latências excluem chamadas frias");
  });

  it("gera tabela pronta para o README", () => {
    const resultados = [
      resultado({ modelo: "m1", nota: 2 }),
      resultado({
        modelo: "m1",
        catastrofica: true,
        nota: 0,
      }),
      resultado({ modelo: "m2", categoria: "relevance", nota: 1 }),
    ];

    const tabela = tabelaParaReadme(resultados);

    expect(tabela).toContain("| Modelo | Score total |");
    expect(tabela).toContain("| `m1` | 50.0% |");
    expect(tabela).toContain("| `m2` | 50.0% |");
    expect(tabela).toContain("Catastróficas");
  });
});

describe("gerarCsv", () => {
  it("inclui cabeçalho e escapa campos", () => {
    const csv = gerarCsv([
      resultado({ motivo: 'falhou, "de propósito"\nlinha 2' }),
    ]);

    expect(csv.split("\n")[0]).toBe(
      "casoId,categoria,modelo,repeticao,nota,catastrofica,motivo,tokensEntrada,tokensSaida,tempoMs,fria",
    );
    expect(csv).toContain('"falhou, ""de propósito""');
  });
});

describe("gerarRelatorio", () => {
  it("lê resultados.jsonl e grava relatorio.md e relatorio.csv", async () => {
    const arquivo = join(dir, "resultados.jsonl");
    await writeFile(
      arquivo,
      [
        JSON.stringify(resultado({ casoId: "acc-1" })),
        JSON.stringify(resultado({ casoId: "acc-2", nota: 1 })),
      ].join("\n"),
      "utf8",
    );

    const relatorio = await gerarRelatorio(arquivo);

    expect(await lerResultados(arquivo)).toHaveLength(2);
    expect(await readFile(relatorio.arquivoMd, "utf8")).toContain(
      "# Relatório de Evals",
    );
    expect(await readFile(relatorio.arquivoCsv, "utf8")).toContain("acc-1");
    expect(relatorio.arquivoMd).toBe(join(dir, "relatorio.md"));
  });

  it("rejeita JSON inválido com a linha", async () => {
    const arquivo = join(dir, "resultados.jsonl");
    await writeFile(
      arquivo,
      `${JSON.stringify(resultado())}\n{quebrado\n`,
      "utf8",
    );

    await expect(lerResultados(arquivo)).rejects.toBeInstanceOf(RelatorioError);
    await expect(lerResultados(arquivo)).rejects.toThrow("Linha 2");
  });
});
