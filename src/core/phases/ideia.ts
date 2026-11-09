import type { Phase } from "./types.js";

export const ideiaPhase: Phase = {
  id: "ideia",
  title: "Ideia",
  instruction:
    "Você está ajudando o aluno a explicar a ideia do projeto. Faça perguntas abertas e não sugira a solução.",
  questions: [
    {
      id: "ideia-want",
      prompt: "O que você quer construir?",
      isAnswered: (state) => Boolean(state.idea.want?.trim()),
      apply: (state, answer) => {
        state.idea.want = answer.trim();
      },
      reset: (state) => {
        delete state.idea.want;
      },
    },
    {
      id: "ideia-how",
      prompt: "Como você imagina que isso vai funcionar?",
      isAnswered: (state) => Boolean(state.idea.how?.trim()),
      apply: (state, answer) => {
        state.idea.how = answer.trim();
      },
      reset: (state) => {
        delete state.idea.how;
      },
    },
    {
      id: "ideia-dont-want",
      prompt: "O que você não quer que o projeto tenha?",
      isAnswered: (state) => Boolean(state.idea.dontWant?.trim()),
      apply: (state, answer) => {
        state.idea.dontWant = answer.trim();
      },
      reset: (state) => {
        delete state.idea.dontWant;
      },
    },
    {
      id: "ideia-success",
      prompt: "Como você vai saber que o resultado foi alcançado?",
      isAnswered: (state) => Boolean(state.idea.success?.trim()),
      apply: (state, answer) => {
        state.idea.success = answer.trim();
      },
      reset: (state) => {
        delete state.idea.success;
      },
    },
  ],
  next: () => "perguntas",
};
