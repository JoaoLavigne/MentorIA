import type { WorkMode } from "../session.js";
import { InvalidAnswerError, type Phase } from "./types.js";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function parseMode(answer: string): WorkMode {
  const value = normalize(answer);

  if (/^1\b/.test(value)) return "projeto";
  if (/^2\b/.test(value)) return "algoritmo";

  if (/\b(algoritmo|estrutura de dados|problema|exercicio|leetcode)\b/.test(value)) {
    return "algoritmo";
  }

  if (/\b(projeto|criar|construir|app|aplicacao|sistema)\b/.test(value)) {
    return "projeto";
  }

  throw new InvalidAnswerError(
    "Não entendi o modo. Responda com \"criar um projeto\" ou \"resolver um problema de estrutura de dados/algoritmos\".",
  );
}

export const escolhaModoPhase: Phase = {
  id: "escolha-modo",
  title: "Escolha do modo",
  instruction:
    "Você ajuda o aluno a escolher entre criar um projeto do zero e resolver um problema de estrutura de dados/algoritmos. Não escolha por ele.",
  intro: [
    "Antes de escolher, entenda os dois modos:",
    "",
    "- **Criar um projeto:** você parte de uma ideia e o Mentor conduz por requisitos, arquitetura e implementação em camadas — você decide e explica cada passo.",
    "- **Resolver um problema de algoritmo/estrutura de dados:** você cola um enunciado e o Mentor desenha a solução apenas logicamente, em passos e sem código, para você implementar e explicar depois.",
  ].join("\n"),
  questions: [
    {
      id: "modo",
      prompt:
        "Você quer criar um projeto do zero ou resolver um problema de estrutura de dados/algoritmos?",
      isAnswered: (state) => state.mode !== undefined,
      apply: (state, answer) => {
        state.mode = parseMode(answer);
      },
      reset: (state) => {
        delete state.mode;
      },
    },
  ],
  next: (state) => (state.mode === "algoritmo" ? "enunciado" : "ideia"),
};
