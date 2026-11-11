import { basename } from "node:path";
import { getPhase, phaseNumber } from "./phases/index.js";
import {
  backupSession,
  inspectSession,
  type SessionState,
} from "./session.js";

export type SessionSummary = {
  project: string;
  stage: string;
};

export type SessionResolution =
  | { action: "fresh" }
  | { action: "resume" }
  | { action: "restarted"; backup: string }
  | { action: "recovered"; backup: string };

export type SessionResolverDeps = {
  ask(message: string): Promise<string>;
  write(message: string): void;
};

const CONTINUE_ANSWER = /^(?:1|continuar|c|retomar|r)$/i;
const RESTART_ANSWER = /^(?:2|nova|novo|comecar|recomecar|n)$/i;

export function describeSession(
  state: SessionState,
  projectDir: string,
): SessionSummary {
  const project = basename(projectDir).trim() || "sem nome";

  let stage: string;
  try {
    const phase = getPhase(state.currentPhase);
    stage = `FASE ${phaseNumber(phase.id, state.mode)} [${phase.title}]`;
  } catch {
    stage = state.currentPhase;
  }

  return { project, stage };
}

export async function resolveSessionMenu(
  projectDir: string,
  deps: SessionResolverDeps,
): Promise<SessionResolution> {
  const inspection = await inspectSession(projectDir);

  if (inspection.kind === "none") {
    return { action: "fresh" };
  }

  if (inspection.kind === "corrupt") {
    const backup = await backupSession(projectDir, "corrupt");

    deps.write(
      "A sessão anterior estava inválida ou corrompida. Guardei um backup e vou começar do zero.",
    );

    return { action: "recovered", backup: backup ?? "" };
  }

  const summary = describeSession(inspection.state, projectDir);
  deps.write(
    `Encontrei uma sessão anterior: projeto "${summary.project}", parou na etapa "${summary.stage}".`,
  );
  deps.write(
    "  [1] Continuar   [2] Começar uma nova (guarda a antiga como backup)",
  );

  while (true) {
    const answer = (await deps.ask("> ")).trim();

    if (CONTINUE_ANSWER.test(answer)) {
      return { action: "resume" };
    }

    if (RESTART_ANSWER.test(answer)) {
      const backup = await backupSession(projectDir, "backup");

      return { action: "restarted", backup: backup ?? "" };
    }

    deps.write('Entrada inválida. Responda com "1" para continuar ou "2" para começar uma nova.');
  }
}
