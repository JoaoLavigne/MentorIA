import { mkdir, rm } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createSession, saveSession } from "../../session.js";
import type { Caso } from "../types.js";

export class SandboxError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SandboxError";
  }
}

export const TMP_DIR = fileURLToPath(new URL("../tmp/", import.meta.url));

export function raizSandbox(): string {
  return TMP_DIR;
}

export type CriarSandboxOptions = {
  raiz?: string;
};

export type LimparSandboxOptions = {
  raiz?: string;
  keep?: boolean;
};

function segmento(valor: string, nome: string): string {
  const trimmed = valor.trim();

  if (
    trimmed.length === 0 ||
    trimmed === "." ||
    trimmed === ".." ||
    isAbsolute(trimmed) ||
    trimmed.includes("/") ||
    trimmed.includes("\\")
  ) {
    throw new SandboxError(
      `Valor inválido para ${nome}: "${valor}". Use um único segmento de pasta.`,
    );
  }

  return trimmed;
}

function dentroDe(raiz: string, alvo: string): boolean {
  return alvo === raiz || alvo.startsWith(`${raiz}${sep}`);
}

export async function criarSandbox(
  rodadaId: string,
  casoId: string,
  options: CriarSandboxOptions = {},
): Promise<string> {
  const raiz = resolve(options.raiz ?? TMP_DIR);
  const pasta = resolve(
    raiz,
    segmento(rodadaId, "rodadaId"),
    segmento(casoId, "casoId"),
  );

  if (!dentroDe(raiz, pasta)) {
    throw new SandboxError(
      `A pasta do sandbox ficou fora de tmp/: ${pasta}.`,
    );
  }

  await mkdir(pasta, { recursive: true });

  return pasta;
}

export async function gravarEstadoInicial(
  sandboxDir: string,
  caso: Caso,
): Promise<string> {
  const estado = createSession();
  estado.mode = caso.modo;
  estado.currentPhase = caso.fase;

  await saveSession(sandboxDir, estado);

  return join(sandboxDir, ".mentor", "session.json");
}

export async function limparSandbox(
  sandboxDir: string,
  options: LimparSandboxOptions = {},
): Promise<boolean> {
  const raiz = resolve(options.raiz ?? TMP_DIR);
  const alvo = resolve(sandboxDir);

  if (!alvo.startsWith(`${raiz}${sep}`)) {
    throw new SandboxError(
      `Recusando apagar fora de tmp/: ${alvo}.`,
    );
  }

  const relativo = relative(raiz, alvo).split(sep).filter(Boolean);

  if (relativo.length < 2) {
    throw new SandboxError(
      `Recusando apagar a raiz ou uma rodada inteira de tmp/: ${alvo}.`,
    );
  }

  if (options.keep) {
    return false;
  }

  await rm(alvo, { recursive: true, force: true });

  return true;
}
