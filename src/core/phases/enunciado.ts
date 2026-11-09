import type { Phase } from "./types.js";

export const enunciadoPhase: Phase = {
  id: "enunciado",
  title: "Enunciado",
  instruction:
    "Você está coletando o enunciado de um problema de estrutura de dados/algoritmos, sem resolvê-lo ainda.",
  questions: [
    {
      id: "problema-enunciado",
      prompt:
        "Cole o enunciado do problema de estrutura de dados/algoritmos que você quer resolver.",
      isAnswered: (state) => Boolean(state.problem.statement?.trim()),
      apply: (state, answer) => {
        state.problem.statement = answer.trim();
      },
      reset: (state) => {
        delete state.problem.statement;
        delete state.problem.design;
      },
    },
  ],
  next: () => "desenho",
};
