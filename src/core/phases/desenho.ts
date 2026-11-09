import type { Phase } from "./types.js";

export const desenhoPhase: Phase = {
  id: "desenho",
  title: "Desenho lógico",
  instruction:
    "Você desenha a solução de um problema apenas logicamente, em passos, sem escrever código. O aluno é quem vai implementar.",
  questions: [],
  generation: {
    prompt: (state) => `Enunciado do problema:

${state.problem.statement ?? ""}

Desenhe a implementação que resolve o problema, apenas logicamente e sem código, neste formato:

1. Entender o problema: o que deve ser retornado e quais armadilhas o enunciado esconde.
2. Tentar a ideia óbvia e quebrá-la: a solução mais direta e o caso concreto em que ela falha.
3. A ideia central: a estratégia que cobre os casos quebrados, em linguagem natural.
4. O que programar, em ordem: os passos lógicos da implementação, sem código — índices, laços, condições e a ordem das checagens.
5. Bordas: entradas vazias, limites, duplicatas, tipos inválidos e pior caso.`,
    isDone: (state) =>
      Boolean(state.problem.design?.trim()) ||
      !state.problem.statement?.trim(),
    apply: (state, output) => {
      state.problem.design = output.trim();
    },
    reset: (state) => {
      delete state.problem.design;
    },
  },
  next: () => null,
};
