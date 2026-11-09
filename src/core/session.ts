import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const SESSION_VERSION = 1;
export const FIRST_PHASE = "conhecendo-dev";

export type WorkMode = "projeto" | "algoritmo";

export type StudentProfile = {
  level?: string;
  tools?: string[];
  language?: string;
  aiExperience?: string;
  learningGoals?: string;
};

export type Idea = {
  want?: string;
  how?: string;
  dontWant?: string;
  success?: string;
};

export type Problem = {
  statement?: string;
  design?: string;
};

export type Decision = {
  question: string;
  chosen: string;
  rejected: string;
  reason: string;
};

export type Layer = {
  name: string;
  summary: string;
  approved: boolean;
  expectation?: string;
  code?: string;
  file?: string;
};

export type TestResult = {
  name: string;
  result: "aprovado" | "reprovado" | "nao_verificado";
};

export type Understanding = {
  status: "pendente" | "concluido" | "pulado";
  notes?: string;
};

export type Security = {
  minimum?: string;
  findings?: string[];
};

export type Confirmation = {
  summary?: string;
  approved?: boolean;
};

export type Closing = {
  learned?: string;
  different?: string;
};

export type SessionState = {
  version: number;
  currentPhase: string;
  updatedAt: string;
  mode?: WorkMode;
  student: StudentProfile;
  idea: Idea;
  problem: Problem;
  answers: Record<string, string>;
  skippedPhases: string[];
  architecture: Record<string, string>;
  decisions: Decision[];
  edgeCases: string[];
  layers: Layer[];
  tests: TestResult[];
  understanding: Understanding;
  security: Security;
  confirmation: Confirmation;
  closing: Closing;
};

export class SessionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SessionError";
  }
}

export function createSession(): SessionState {
  return {
    version: SESSION_VERSION,
    currentPhase: FIRST_PHASE,
    updatedAt: new Date().toISOString(),
    student: {},
    idea: {},
    problem: {},
    answers: {},
    skippedPhases: [],
    architecture: {},
    decisions: [],
    edgeCases: [],
    layers: [],
    tests: [],
    understanding: { status: "pendente" },
    security: {},
    confirmation: {},
    closing: {},
  };
}

function sessionFile(projectDir: string): string {
  return join(projectDir, ".mentor", "session.json");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidSession(value: unknown): value is SessionState {
  if (!isRecord(value)) return false;
  if (value.version !== SESSION_VERSION) return false;
  if (typeof value.currentPhase !== "string") return false;
  if (typeof value.updatedAt !== "string") return false;
  if (value.mode !== undefined) {
    if (value.mode !== "projeto" && value.mode !== "algoritmo") return false;
  }
  if (!isRecord(value.student)) return false;
  if (!isRecord(value.idea)) return false;
  if (value.problem !== undefined && !isRecord(value.problem)) return false;
  if (!isRecord(value.answers)) return false;
  if (value.skippedPhases !== undefined && !Array.isArray(value.skippedPhases)) {
    return false;
  }
  if (!isRecord(value.architecture)) return false;
  if (!Array.isArray(value.decisions)) return false;
  if (!Array.isArray(value.edgeCases)) return false;
  if (!Array.isArray(value.layers)) return false;
  if (!Array.isArray(value.tests)) return false;
  if (!isRecord(value.understanding)) return false;

  const status = value.understanding.status;
  if (status !== "pendente" && status !== "concluido" && status !== "pulado") {
    return false;
  }

  if (!isRecord(value.security)) return false;
  if (value.confirmation !== undefined && !isRecord(value.confirmation)) {
    return false;
  }

  return true;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

export async function loadSession(projectDir: string): Promise<SessionState> {
  const file = sessionFile(projectDir);

  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return createSession();
    }

    throw new SessionError(
      `Não foi possível ler o estado da sessão em ${file}. Verifique as permissões do arquivo.`,
      { cause: error },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new SessionError(
      `O estado da sessão em ${file} está corrompido. Apague o arquivo para começar de novo.`,
      { cause: error },
    );
  }

  if (!isValidSession(parsed)) {
    throw new SessionError(
      `O estado da sessão em ${file} está em um formato inválido. Apague o arquivo para começar de novo.`,
    );
  }

  return {
    ...parsed,
    problem: isRecord(parsed.problem) ? (parsed.problem as Problem) : {},
    skippedPhases: Array.isArray(parsed.skippedPhases)
      ? (parsed.skippedPhases as string[])
      : [],
    confirmation: isRecord(parsed.confirmation)
      ? (parsed.confirmation as Confirmation)
      : {},
    closing: isRecord(parsed.closing) ? (parsed.closing as Closing) : {},
  };
}

export async function saveSession(
  projectDir: string,
  state: SessionState,
): Promise<void> {
  const file = sessionFile(projectDir);
  const dir = join(projectDir, ".mentor");
  const temp = `${file}.tmp`;
  const next: SessionState = { ...state, updatedAt: new Date().toISOString() };

  if (!isValidSession(next)) {
    throw new SessionError(
      "O estado da sessão em memória está inválido e não pode ser salvo.",
    );
  }

  try {
    await ensureMentorIgnored(projectDir);
    await mkdir(dir, { recursive: true });
    await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true }).catch(() => undefined);

    if (error instanceof SessionError) throw error;

    throw new SessionError(
      `Não foi possível salvar o estado da sessão em ${file}. Verifique as permissões da pasta.`,
      { cause: error },
    );
  }
}

export async function ensureMentorIgnored(projectDir: string): Promise<void> {
  const file = join(projectDir, ".gitignore");

  let current = "";
  try {
    current = await readFile(file, "utf8");
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw new SessionError(
        `Não foi possível atualizar ${file} para ignorar a pasta .mentor/.`,
        { cause: error },
      );
    }
  }

  const alreadyIgnored = current
    .split(/\r?\n/)
    .some((line) => line.trim() === ".mentor" || line.trim() === ".mentor/");

  if (alreadyIgnored) return;

  const separator = current.length === 0 || current.endsWith("\n") ? "" : "\n";
  await writeFile(file, `${current}${separator}.mentor/\n`, "utf8");
}
