import type { SessionState } from "../session.js";
import { conhecendoDevPhase } from "./conhecendoDev.js";
import { escolhaModoPhase } from "./escolhaModo.js";
import { esbocoPhase } from "./esboco.js";
import { ideiaPhase } from "./ideia.js";
import { perguntasPhase } from "./perguntas.js";
import {
  InvalidAnswerError,
  resetPhase,
  type Phase,
  type Question,
} from "./types.js";

const editablePhases: Phase[] = [
  conhecendoDevPhase,
  escolhaModoPhase,
  ideiaPhase,
  perguntasPhase,
  esbocoPhase,
];

type Command =
  | { kind: "approve" }
  | { kind: "redo"; target: string }
  | { kind: "edit"; target: string };

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function describe(state: SessionState): string {
  const idea = state.idea ?? {};
  const answers = Object.entries(state.answers ?? {})
    .filter(([, value]) => value.trim().length > 0)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");
  const architecture = Object.entries(state.architecture ?? {})
    .filter(([, value]) => value.trim().length > 0)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");
  const edges = state.edgeCases.map((value) => `- ${value}`).join("\n");

  return [
    `O que quer construir: ${idea.want ?? "-"}`,
    `Como imagina que funciona: ${idea.how ?? "-"}`,
    `O que não quer: ${idea.dontWant ?? "-"}`,
    `Como medir o sucesso: ${idea.success ?? "-"}`,
    "",
    "Respostas:",
    answers || "-",
    "",
    "Arquitetura:",
    architecture || "-",
    "",
    "Casos de borda:",
    edges || "-",
  ].join("\n");
}

function findPhase(target: string): Phase | undefined {
  const value = normalize(target).replace(/^fase\s+/, "").trim();

  return editablePhases.find(
    (phase) =>
      normalize(phase.id) === value || normalize(phase.title) === value,
  );
}

function findQuestion(
  target: string,
): { phase: Phase; question: Question } | undefined {
  const value = normalize(target);

  for (const phase of editablePhases) {
    for (const question of phase.questions) {
      if (normalize(question.id) === value) {
        return { phase, question };
      }
    }
  }

  return undefined;
}

function helpMessage(): string {
  const phases = editablePhases.map((phase) => phase.id).join(", ");
  const questions = editablePhases
    .flatMap((phase) => phase.questions.map((question) => question.id))
    .join(", ");

  return `Não entendi. Digite "aprovar", "refazer <fase>" (${phases}) ou "alterar <resposta>" (${questions}).`;
}

function parseCommand(answer: string): Command {
  const value = normalize(answer);

  if (/^(?:aprovar|aprovo|aprovado|confirmar|confirmo|sim|ok)\b/.test(value)) {
    return { kind: "approve" };
  }

  const redo = value.match(
    /^(?:refazer|refaz|refaca|replanejar|planejar de novo)\s+(?:a\s+)?(?:fase\s+)?(.+)$/,
  );

  if (redo) {
    return { kind: "redo", target: redo[1].trim() };
  }

  const edit = value.match(
    /^(?:alterar|altera|mudar|muda|editar|edita)\s+(?:a\s+)?(?:resposta\s+)?(.+)$/,
  );

  if (edit) {
    return { kind: "edit", target: edit[1].trim() };
  }

  throw new InvalidAnswerError(helpMessage());
}

export const confirmacaoPhase: Phase = {
  id: "confirmacao",
  title: "Confirmação",
  instruction:
    "Você resume o que será implementado, com base no projeto do aluno, para ele aprovar. Não escreva código nem entregue a solução.",
  generation: {
    prompt: (state) =>
      `Projeto do aluno:\n\n${describe(state)}\n\nEscreva um resumo curto do que será implementado: o objetivo, as partes principais e como os dados fluem. Não escreva código.`,
    isDone: (state) => Boolean(state.confirmation.summary?.trim()),
    apply: (state, output) => {
      state.confirmation.summary = output.trim();
    },
    reset: (state) => {
      delete state.confirmation.summary;
    },
  },
  questions: [
    {
      id: "confirmacao",
      prompt:
        "Você aprova o projeto? Para ajustar antes, diga \"refazer <fase>\" ou \"alterar <resposta>\". Fases: conhecendo-dev, escolha-modo, ideia, perguntas, esboco.",
      isAnswered: (state) => state.confirmation.approved === true,
      apply: (state, answer) => {
        const command = parseCommand(answer);

        if (command.kind === "approve") {
          state.confirmation.approved = true;
          return;
        }

        if (command.kind === "redo") {
          const phase = findPhase(command.target);

          if (!phase) {
            throw new InvalidAnswerError(helpMessage());
          }

          state.confirmation = {};
          state.skippedPhases = state.skippedPhases.filter(
            (id) => id !== phase.id,
          );
          resetPhase(phase, state);
          state.currentPhase = phase.id;
          return { handled: true };
        }

        const found = findQuestion(command.target);

        if (!found) {
          throw new InvalidAnswerError(helpMessage());
        }

        state.confirmation = {};
        state.skippedPhases = state.skippedPhases.filter(
          (id) => id !== found.phase.id,
        );
        delete state.answers[found.question.id];
        found.question.reset?.(state);
        state.currentPhase = found.phase.id;
        return { handled: true };
      },
      reset: (state) => {
        delete state.confirmation.approved;
      },
    },
  ],
  next: (state) => (state.mode === "algoritmo" ? null : "implementacao"),
};
