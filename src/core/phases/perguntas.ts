import type { Phase, Question } from "./types.js";

function storeAnswer(id: string, prompt: string): Question {
  return {
    id,
    prompt,
    isAnswered: (state) => Boolean(state.answers[id]?.trim()),
    apply: (state, answer) => {
      state.answers[id] = answer.trim();
    },
    reset: (state) => {
      delete state.answers[id];
    },
  };
}

export const perguntasPhase: Phase = {
  id: "perguntas",
  title: "Perguntas",
  instruction:
    "Você investiga o núcleo do projeto, entradas, processamento, saídas, critérios de aceitação e arquitetura. Não escreva código nem entregue a solução.",
  questions: [
    storeAnswer(
      "nucleo",
      "Qual é o núcleo do projeto, ou seja, a parte que precisa funcionar para ele fazer sentido?",
    ),
    storeAnswer("entradas", "Quais são as entradas do projeto?"),
    storeAnswer(
      "processamento",
      "Como o projeto vai processar essas entradas?",
    ),
    storeAnswer("saidas", "Quais são as saídas esperadas?"),
    storeAnswer(
      "criterios",
      "Quais são os critérios de aceitação do projeto?",
    ),
    {
      id: "arquitetura",
      prompt:
        "O que você pensou sobre interfaces, dependências, persistência de dados, limites entre os módulos e arquitetura?",
      isAnswered: (state) => Boolean(state.architecture["visao"]?.trim()),
      apply: (state, answer) => {
        state.architecture["visao"] = answer.trim();
      },
      reset: (state) => {
        delete state.architecture["visao"];
      },
    },
  ],
  next: () => "esboco",
};
