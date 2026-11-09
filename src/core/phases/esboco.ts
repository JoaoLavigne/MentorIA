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

export const esbocoPhase: Phase = {
  id: "esboco",
  title: "Esboço",
  instruction:
    "Você ajuda o aluno a esboçar o projeto: integração, validação e comunicação entre as partes. O aluno decide; você apenas pergunta. Não escreva código nem entregue a solução.",
  questions: [
    storeAnswer(
      "esboco-integracao",
      "Descreva como as partes do projeto se integram, se validam e se comunicam entre si.",
    ),
    storeAnswer(
      "esboco-completude",
      "Quais informações você acha relevantes e ainda não disse?",
    ),
    {
      id: "esboco-interface",
      prompt:
        "Como você quer o layout/interface do projeto? Descreva nos mínimos detalhes: telas, botões, cores, plano de fundo, campos de inserção de dados e a organização visual. Não deixe nada implícito.",
      isAnswered: (state) => Boolean(state.architecture["interface"]?.trim()),
      apply: (state, answer) => {
        state.architecture["interface"] = answer.trim();
      },
      reset: (state) => {
        delete state.architecture["interface"];
      },
    },
    {
      id: "esboco-core-journey",
      prompt:
        "Desenvolva o The core journey: descreva com detalhes e precisão como o seu usuário vai utilizar o software, passo a passo, do primeiro acesso ao objetivo final.",
      isAnswered: (state) => Boolean(state.architecture["jornada"]?.trim()),
      apply: (state, answer) => {
        state.architecture["jornada"] = answer.trim();
      },
      reset: (state) => {
        delete state.architecture["jornada"];
      },
    },
    {
      id: "esboco-fora-mvp",
      prompt:
        "O que vale a pena ser construído futuramente, mas fica fora do MVP desta versão? Descreva o que deixaria para depois e por quê.",
      isAnswered: (state) => Boolean(state.architecture["fora-mvp"]?.trim()),
      apply: (state, answer) => {
        state.architecture["fora-mvp"] = answer.trim();
      },
      reset: (state) => {
        delete state.architecture["fora-mvp"];
      },
    },
    {
      id: "esboco-bordas",
      prompt:
        "Com base no projeto descrito no contexto, identifique os pontos mais propensos a falhar (entradas inválidas, limites, dependências ou persistência) e pergunte ao aluno o que deve acontecer em cada um deles. Não responda pelo aluno.",
      isAnswered: (state) => state.edgeCases.length > 0,
      apply: (state, answer) => {
        const value = answer.trim();
        if (value) state.edgeCases = [value];
      },
      reset: (state) => {
        state.edgeCases = [];
      },
    },
    {
      id: "esboco-ferramenta",
      prompt:
        "Você tem preferência por alguma ferramenta para este projeto? Por quê?",
      isAnswered: (state) => Boolean(state.architecture["ferramenta"]?.trim()),
      apply: (state, answer) => {
        state.architecture["ferramenta"] = answer.trim();
      },
      reset: (state) => {
        delete state.architecture["ferramenta"];
      },
    },
  ],
  next: () => "confirmacao",
};
