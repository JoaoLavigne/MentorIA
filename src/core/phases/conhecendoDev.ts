import type { Phase } from "./types.js";

function parseTools(answer: string): string[] {
  return answer
    .split(/[,;]|\s+e\s+|\//i)
    .map((tool) => tool.trim())
    .filter((tool) => tool.length > 0);
}

export const conhecendoDevPhase: Phase = {
  id: "conhecendo-dev",
  title: "Conhecendo o DEV",
  instruction:
    "Você está conhecendo o aluno. Ajuste o vocabulário ao nível dele, mas não presuma nada que ele ainda não disse.",
  questions: [
    {
      id: "nivel",
      prompt:
        "Qual é o seu nível de experiência com programação? (por exemplo: nunca programei, iniciante, intermediário ou avançado)",
      isAnswered: (state) => Boolean(state.student.level?.trim()),
      apply: (state, answer) => {
        state.student.level = answer.trim();
      },
      reset: (state) => {
        delete state.student.level;
      },
    },
    {
      id: "ferramentas",
      prompt:
        "Quais ferramentas você já usou? (editor, terminal, Git, banco de dados, etc.)",
      isAnswered: (state) => (state.student.tools?.length ?? 0) > 0,
      apply: (state, answer) => {
        state.student.tools = parseTools(answer);
      },
      reset: (state) => {
        delete state.student.tools;
      },
    },
    {
      id: "linguagem",
      prompt: "Qual linguagem você prefere usar neste projeto?",
      isAnswered: (state) => Boolean(state.student.language?.trim()),
      apply: (state, answer) => {
        state.student.language = answer.trim();
      },
      reset: (state) => {
        delete state.student.language;
      },
    },
    {
      id: "experiencia-ia",
      prompt:
        "Você tem experiência com desenvolvimento assistido por IA? Como foi?",
      isAnswered: (state) => Boolean(state.student.aiExperience?.trim()),
      apply: (state, answer) => {
        state.student.aiExperience = answer.trim();
      },
      reset: (state) => {
        delete state.student.aiExperience;
      },
    },
    {
      id: "objetivos",
      prompt:
        "O que você quer aprender? Quais habilidades você mais quer desenvolver?",
      isAnswered: (state) => Boolean(state.student.learningGoals?.trim()),
      apply: (state, answer) => {
        state.student.learningGoals = answer.trim();
      },
      reset: (state) => {
        delete state.student.learningGoals;
      },
    },
  ],
  next: () => "escolha-modo",
};
