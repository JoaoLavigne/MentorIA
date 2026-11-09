import type { Phase, Question } from "./types.js";

function answerQuestion(id: string, prompt: string): Question {
  return {
    id,
    prompt,
    isAnswered: (state) => Boolean(state.answers[id]?.trim()),
    apply: (state, value) => {
      state.answers[id] = value.trim();
    },
    reset: (state) => {
      delete state.answers[id];
    },
  };
}

function splitFindings(value: string): string[] {
  return value
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export const entendimentoPhase: Phase = {
  id: "entendimento",
  title: "Entendimento",
  instruction:
    "Você verifica se o aluno entende o que foi implementado. Faça uma pergunta por vez, cobre explicações concretas e não entregue a resposta nem escreva código.",
  questions: [
    answerQuestion(
      "entendimento-nucleo",
      "Explique como funciona o núcleo do projeto.",
    ),
    answerQuestion(
      "entendimento-arquitetura",
      "Justifique por que você optou por essa arquitetura.",
    ),
    answerQuestion(
      "entendimento-testes",
      "Crie 3 testes que validem o comportamento esperado.",
    ),
    {
      id: "entendimento-seguranca",
      prompt: "Quais são os principais riscos de segurança do projeto?",
      isAnswered: (state) =>
        (state.security.findings?.length ?? 0) > 0,
      apply: (state, value) => {
        state.security.findings = splitFindings(value);
      },
      reset: (state) => {
        delete state.security.findings;
      },
    },
    answerQuestion(
      "entendimento-regra",
      "Qual regra do programa é inquebrável?",
    ),
  ],
  next: (state) => {
    state.understanding.status = state.skippedPhases.includes("entendimento")
      ? "pulado"
      : "concluido";

    return null;
  },
};
