import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSession, loadSession, saveSession } from "../src/core/session.js";
import { resolveSessionMenu } from "../src/core/sessionResolution.js";

let projectDir: string;

function sessionPath(dir: string): string {
  return join(dir, ".mentor", "session.json");
}

function answers(...values: string[]) {
  const queue = [...values];
  const asked: string[] = [];
  const written: string[] = [];

  return {
    asked,
    written,
    deps: {
      ask: async (message: string) => {
        asked.push(message);
        const next = queue.shift();
        if (next === undefined) throw new Error("sem resposta na fila");
        return next;
      },
      write: (message: string) => {
        written.push(message);
      },
    },
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "mentor-resolution-"));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

describe("resolveSessionMenu", () => {
  it("não pergunta nada quando não existe sessão", async () => {
    const { asked, deps } = answers();

    const result = await resolveSessionMenu(projectDir, deps);

    expect(result).toEqual({ action: "fresh" });
    expect(asked).toHaveLength(0);
  });

  it("retoma a sessão existente na opção 1 sem criar backup", async () => {
    const session = createSession();
    session.answers = { nucleo: "um diário de estudos" };
    session.currentPhase = "ideia";
    await saveSession(projectDir, session);

    const { asked, written, deps } = answers("1");

    const result = await resolveSessionMenu(projectDir, deps);

    expect(result).toEqual({ action: "resume" });
    expect(asked).toHaveLength(1);
    expect(written.join("\n")).toContain("projeto");
    expect(written.join("\n")).toContain("FASE 3 [Ideia]");
    expect(await exists(sessionPath(projectDir))).toBe(true);
  });

  it("guarda a sessão em backup e começa do zero na opção 2", async () => {
    const session = createSession();
    session.answers = { nucleo: "um diário de estudos" };
    await saveSession(projectDir, session);

    const { deps } = answers("2");

    const result = await resolveSessionMenu(projectDir, deps);

    expect(result.action).toBe("restarted");
    const backup = result.action === "restarted" ? result.backup : "";
    expect(backup).toContain(join(".mentor", "backups"));
    expect(backup.endsWith(".json")).toBe(true);
    expect(await exists(backup)).toBe(true);
    expect(await exists(sessionPath(projectDir))).toBe(false);

    const fresh = await loadSession(projectDir);
    expect(fresh.answers).toEqual({});
    expect(fresh.currentPhase).toBe("conhecendo-dev");
  });

  it("faz backup de JSON corrompido e começa nova sem erro", async () => {
    await mkdir(join(projectDir, ".mentor"), { recursive: true });
    await writeFile(sessionPath(projectDir), "{ isto não é json", "utf8");

    const { asked, deps } = answers();

    const result = await resolveSessionMenu(projectDir, deps);

    expect(result.action).toBe("recovered");
    const backup = result.action === "recovered" ? result.backup : "";
    expect(backup.endsWith(".json.bak")).toBe(true);
    expect(await exists(backup)).toBe(true);
    expect(await readFile(backup, "utf8")).toContain("isto não é json");
    expect(await exists(sessionPath(projectDir))).toBe(false);
    expect(asked).toHaveLength(0);

    const fresh = await loadSession(projectDir);
    expect(fresh.answers).toEqual({});
  });

  it("repete a pergunta após entrada inválida e aceita a próxima válida", async () => {
    await saveSession(projectDir, createSession());

    const { asked, written, deps } = answers("talvez", "3", "1");

    const result = await resolveSessionMenu(projectDir, deps);

    expect(result).toEqual({ action: "resume" });
    expect(asked).toHaveLength(3);
    expect(written.filter((line) => line.includes("Entrada inválida"))).toHaveLength(2);
  });
});
