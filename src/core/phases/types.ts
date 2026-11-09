import type { GuardResult } from "../guards.js";
import type { SessionState } from "../session.js";

export type PhaseId =
  | "conhecendo-dev"
  | "escolha-modo"
  | "ideia"
  | "perguntas"
  | "esboco"
  | "enunciado"
  | "desenho"
  | "confirmacao"
  | "implementacao"
  | "camada-preparo"
  | "camada-codigo"
  | "entendimento";

export type ApplyResult = { handled: true };

export type Prompt = string | ((state: SessionState) => string);

export type Question = {
  id: string;
  prompt: Prompt;
  isAnswered(state: SessionState): boolean;
  apply(state: SessionState, answer: string): ApplyResult | void;
  reset?(state: SessionState): void;
};

export type GenerationContext = {
  projectDir: string;
};

export type Generation = {
  prompt(state: SessionState): string;
  isDone(state: SessionState): boolean;
  rules?: string;
  guard?(output: string): GuardResult;
  apply(
    state: SessionState,
    output: string,
    context: GenerationContext,
  ): void | Promise<void>;
  reset?(state: SessionState): void;
};

export type Phase = {
  id: PhaseId;
  title: string;
  instruction: string;
  intro?: string;
  skippable?: boolean;
  questions: Question[];
  generation?: Generation;
  next(state: SessionState): PhaseId | null;
};

export function resolvePrompt(prompt: Prompt, state: SessionState): string {
  return typeof prompt === "string" ? prompt : prompt(state);
}

export function resetPhase(phase: Phase, state: SessionState): void {
  for (const question of phase.questions) {
    delete state.answers[question.id];
    question.reset?.(state);
  }

  phase.generation?.reset?.(state);
}

export class InvalidAnswerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAnswerError";
  }
}
