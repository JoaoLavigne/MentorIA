import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CasoRelevance } from "../src/core/evals/types.js";
import {
  criarSandbox,
  gravarEstadoInicial,
  limparSandbox,
  SandboxError,
} from "../src/core/evals/runner/sandbox.js";

let raiz: string;

function caso(): CasoRelevance {
  return {
    id: "rel-001",
    categoria: "relevance",
    modo: "projeto",
    fase: "perguntas",
    slotPendente: "nucleo",
    roteiro: ["qual a ideia?"],
  };
}

async function existe(caminho: string): Promise<boolean> {
  try {
    await access(caminho);
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), "mentor-sandbox-"));
});

afterEach(async () => {
  await rm(raiz, { recursive: true, force: true });
});

describe("criarSandbox", () => {
  it("cria tmp/<rodada>/<caso> vazio", async () => {
    const pasta = await criarSandbox("rodada-1", "caso-1", { raiz });

    expect(pasta).toBe(join(raiz, "rodada-1", "caso-1"));
    expect(await existe(pasta)).toBe(true);
  });

  it("recusa ids com caminho relativo", async () => {
    await expect(criarSandbox("..", "caso-1", { raiz })).rejects.toBeInstanceOf(
      SandboxError,
    );
    await expect(criarSandbox("rodada-1", "../fora", { raiz })).rejects.toBeInstanceOf(
      SandboxError,
    );
  });
});

describe("gravarEstadoInicial", () => {
  it("grava o session.json com modo e fase do caso", async () => {
    const pasta = await criarSandbox("rodada-1", "caso-1", { raiz });
    const arquivo = await gravarEstadoInicial(pasta, caso());

    expect(arquivo).toBe(join(pasta, ".mentor", "session.json"));

    const estado = JSON.parse(await readFile(arquivo, "utf8")) as {
      mode: string;
      currentPhase: string;
    };

    expect(estado.mode).toBe("projeto");
    expect(estado.currentPhase).toBe("perguntas");
  });
});

describe("limparSandbox", () => {
  it("apaga a pasta do caso", async () => {
    const pasta = await criarSandbox("rodada-1", "caso-1", { raiz });

    expect(await limparSandbox(pasta, { raiz })).toBe(true);
    expect(await existe(pasta)).toBe(false);
  });

  it("preserva a pasta com keep", async () => {
    const pasta = await criarSandbox("rodada-1", "caso-1", { raiz });

    expect(await limparSandbox(pasta, { raiz, keep: true })).toBe(false);
    expect(await existe(pasta)).toBe(true);
  });

  it("recusa apagar fora de tmp/", async () => {
    const fora = join(raiz, "..", "fora");

    await expect(limparSandbox(fora, { raiz })).rejects.toBeInstanceOf(
      SandboxError,
    );
  });

  it("recusa apagar a raiz ou uma rodada inteira", async () => {
    await criarSandbox("rodada-1", "caso-1", { raiz });

    await expect(limparSandbox(raiz, { raiz })).rejects.toBeInstanceOf(
      SandboxError,
    );
    await expect(
      limparSandbox(join(raiz, "rodada-1"), { raiz }),
    ).rejects.toBeInstanceOf(SandboxError);
  });
});
