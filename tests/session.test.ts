import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createSession,
  loadSession,
  saveSession,
  SessionError,
} from "../src/core/session.js";

let projectDir: string;

function sessionPath(dir: string): string {
  return join(dir, ".mentor", "session.json");
}

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "mentor-session-"));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

describe("createSession", () => {
  it("cria uma sessão vazia com os campos base", () => {
    const session = createSession();

    expect(session.version).toBe(1);
    expect(session.currentPhase).toBe("conhecendo-dev");
    expect(session.answers).toEqual({});
    expect(session.skippedPhases).toEqual([]);
    expect(session.decisions).toEqual([]);
    expect(session.edgeCases).toEqual([]);
    expect(session.layers).toEqual([]);
    expect(session.tests).toEqual([]);
    expect(session.understanding.status).toBe("pendente");
    expect(session.confirmation).toEqual({});
    expect(Number.isNaN(Date.parse(session.updatedAt))).toBe(false);
  });
});

describe("loadSession", () => {
  it("retorna uma sessão vazia quando ainda não existe estado salvo", async () => {
    const session = await loadSession(projectDir);

    expect(session.currentPhase).toBe("conhecendo-dev");
    expect(session.answers).toEqual({});
    expect(session.student).toEqual({});
  });

  it("assume lista vazia de fases puladas em sessões antigas", async () => {
    const session: Record<string, unknown> = { ...createSession() };
    delete session.skippedPhases;

    await mkdir(join(projectDir, ".mentor"), { recursive: true });
    await writeFile(sessionPath(projectDir), JSON.stringify(session), "utf8");

    const loaded = await loadSession(projectDir);

    expect(loaded.skippedPhases).toEqual([]);
  });

  it("distingue uma sessão vazia de um arquivo de estado existente", async () => {
    const session = createSession();
    session.answers = { nucleo: "um diário de estudos" };
    await saveSession(projectDir, session);

    const loaded = await loadSession(projectDir);

    expect(loaded.answers).toEqual({ nucleo: "um diário de estudos" });
  });

  it("lança SessionError quando o JSON está corrompido", async () => {
    await mkdir(join(projectDir, ".mentor"), { recursive: true });
    await writeFile(sessionPath(projectDir), "{ isto não é json", "utf8");

    await expect(loadSession(projectDir)).rejects.toBeInstanceOf(SessionError);
  });

  it("lança SessionError quando o JSON não tem o formato de sessão", async () => {
    await mkdir(join(projectDir, ".mentor"), { recursive: true });
    await writeFile(sessionPath(projectDir), JSON.stringify({ foo: "bar" }), "utf8");

    await expect(loadSession(projectDir)).rejects.toBeInstanceOf(SessionError);
  });

  it("lança SessionError quando o arquivo de estado não pode ser lido", async () => {
    await mkdir(sessionPath(projectDir), { recursive: true });

    await expect(loadSession(projectDir)).rejects.toBeInstanceOf(SessionError);
  });
});

describe("saveSession", () => {
  it("salva e recupera o estado completo", async () => {
    const session = createSession();
    session.student = {
      level: "iniciante",
      tools: ["VS Code"],
      language: "TypeScript",
    };
    session.answers = { nucleo: "um diário de estudos" };
    session.decisions = [
      {
        question: "Como persistir os dados?",
        chosen: "arquivo JSON",
        rejected: "banco de dados",
        reason: "simplicidade no MVP",
      },
    ];

    await saveSession(projectDir, session);
    const loaded = await loadSession(projectDir);

    expect(loaded.student).toEqual(session.student);
    expect(loaded.answers).toEqual(session.answers);
    expect(loaded.decisions).toEqual(session.decisions);
  });

  it("lança SessionError quando não consegue salvar", async () => {
    const notADirectory = join(projectDir, "arquivo");
    await writeFile(notADirectory, "", "utf8");

    await expect(
      saveSession(notADirectory, createSession()),
    ).rejects.toBeInstanceOf(SessionError);
  });

  it("garante .mentor/ no .gitignore sem duplicar", async () => {
    await writeFile(join(projectDir, ".gitignore"), "node_modules/\n", "utf8");

    await saveSession(projectDir, createSession());
    await saveSession(projectDir, createSession());

    const content = await readFile(join(projectDir, ".gitignore"), "utf8");
    expect(content.match(/^\.mentor\/$/gm)).toHaveLength(1);
  });
});

describe("mensagens para o usuário", () => {
  it("não vaza o erro cru do JSON e explica o problema da sessão", async () => {
    await mkdir(join(projectDir, ".mentor"), { recursive: true });
    await writeFile(sessionPath(projectDir), "{ isto não é json", "utf8");

    const error = await loadSession(projectDir).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(SessionError);
    expect((error as Error).message).toMatch(/sessão|estado/i);
    expect((error as Error).message).not.toMatch(/Unexpected token|JSON\.parse/i);
  });

  it("inclui o caminho do estado na mensagem de erro", async () => {
    await mkdir(join(projectDir, ".mentor"), { recursive: true });
    await writeFile(sessionPath(projectDir), JSON.stringify({ foo: "bar" }), "utf8");

    const error = await loadSession(projectDir).catch((cause: unknown) => cause);

    expect((error as Error).message).toContain("session.json");
  });
});
