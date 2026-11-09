import { parseCodeOutput, writeLayerCode } from "../codeWriter.js";
import { checkImplementationOutput } from "../guards.js";
import type { SessionState } from "../session.js";
import { currentLayer } from "./layers.js";
import { describeProject } from "./projectSummary.js";
import { InvalidAnswerError, type Generation, type Phase } from "./types.js";

function layerToCode(state: SessionState) {
  return state.layers.find(
    (layer) => !layer.approved && layer.expectation !== undefined,
  );
}

const LAYER_NAME =
  /^\s*(?:camada|layer)\s*(?:\d+\s*)?[:.\-]\s*(.+?)\s*$/i;
const LAYER_SUMMARY = /^\s*resumo\s*[:.\-]\s*(.+?)\s*$/i;

export function parseLayerPlan(output: string): { name: string; summary: string }[] {
  const layers: { name: string; summary: string }[] = [];
  let name: string | undefined;
  let summary: string | undefined;

  const flush = () => {
    if (name) {
      layers.push({ name, summary: summary ?? name });
    }
  };

  for (const line of output.split(/\r?\n/)) {
    const nameMatch = line.match(LAYER_NAME);

    if (nameMatch) {
      flush();
      name = nameMatch[1].trim();
      summary = undefined;
      continue;
    }

    const summaryMatch = line.match(LAYER_SUMMARY);

    if (summaryMatch && name) {
      summary = summaryMatch[1].trim();
    }
  }

  flush();

  return layers.slice(0, 8);
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

const planGeneration: Generation = {
  prompt: (state) =>
    `Projeto do aluno:\n\n${describeProject(state)}\n\n` +
    "Proponha a implementação em camadas, de dentro para fora: comece pela parte principal (o núcleo) e só depois " +
    "acrescente interface, persistência e integrações. Use de 2 a 5 camadas, cada uma pequena e verificável.\n\n" +
    "Responda apenas neste formato, uma camada por bloco:\n\n" +
    "Camada: <nome curto>\n" +
    "Resumo: <o que esta camada faz e o que ela entrega>",
  rules:
    "não escreva código e não use blocos de código. Proponha apenas nomes e resumos de camadas.",
  isDone: (state) => state.layers.length > 0,
  guard: (output) =>
    parseLayerPlan(output).length > 0
      ? { ok: true }
      : {
          ok: false,
          reason: 'faltou o formato "Camada: <nome>" e "Resumo: <texto>"',
        },
  apply: (state, output) => {
    state.layers = parseLayerPlan(output).map((layer) => ({
      name: layer.name,
      summary: layer.summary,
      approved: false,
    }));
  },
  reset: (state) => {
    state.layers = [];
    delete state.answers["implementacao-aprovada"];
  },
};

export const implementacaoPhase: Phase = {
  id: "implementacao",
  title: "Implementação",
  instruction:
    "Você propõe a implementação em camadas do projeto do aluno, de dentro para fora. O aluno aprova a sugestão antes de qualquer código.",
  generation: planGeneration,
  questions: [
    {
      id: "implementacao-aprovada",
      prompt:
        'Você aprova esta sugestão de camadas? Responda "aprovar" para começar ou "refazer" para receber outra sugestão.',
      isAnswered: (state) => state.answers["implementacao-aprovada"] === "aprovado",
      apply: (state, answer) => {
        const value = normalize(answer);

        if (/^(?:aprovar|aprovo|aprovado|confirmar|confirmo|sim|ok|comecar|iniciar)\b/.test(value)) {
          state.answers["implementacao-aprovada"] = "aprovado";
          return { handled: true };
        }

        if (/^(?:refazer|refaz|replanejar|outra|gerar de novo)\b/.test(value)) {
          state.layers = [];
          delete state.answers["implementacao-aprovada"];
          return { handled: true };
        }

        throw new InvalidAnswerError(
          'Responda "aprovar" para começar ou "refazer" para receber outra sugestão de camadas.',
        );
      },
      reset: (state) => {
        delete state.answers["implementacao-aprovada"];
      },
    },
  ],
  next: (state) => {
    if (state.skippedPhases.includes("implementacao")) return null;

    return currentLayer(state) ? "camada-preparo" : "entendimento";
  },
};

function layerPrompt(state: SessionState): string {
  const layer = currentLayer(state);

  if (!layer) {
    return "Não há camada pendente. Diga o que você espera da próxima parte do projeto.";
  }

  return `Camada "${layer.summary.trim() || layer.name}": o que você espera que ela faça e onde ela pode falhar?`;
}

export const camadaPreparoPhase: Phase = {
  id: "camada-preparo",
  title: "Preparo da camada",
  instruction:
    "Antes de implementar, você pergunta ao aluno o que ele espera da camada atual e onde ela pode falhar. Não entregue código nem a solução.",
  skippable: false,
  questions: [
    {
      id: "camada-expectativa",
      prompt: layerPrompt,
      isAnswered: (state) => Boolean(currentLayer(state)?.expectation?.trim()),
      apply: (state, answer) => {
        const layer = currentLayer(state);

        if (!layer) {
          throw new InvalidAnswerError("Não há camada pendente para preparar.");
        }

        layer.expectation = answer.trim();
      },
      reset: (state) => {
        const layer = currentLayer(state);

        if (!layer) return;

        delete layer.expectation;
        delete layer.code;
        delete layer.file;
        layer.approved = false;
      },
    },
  ],
  next: (state) => (currentLayer(state) ? "camada-codigo" : null),
};

function approvedLayers(state: SessionState): string {
  const done = state.layers.filter((layer) => layer.approved);

  if (done.length === 0) return "Nenhuma camada implementada ainda.";

  return done
    .map(
      (layer, index) =>
        `${index + 1}. ${layer.name} (${layer.file ?? "arquivo não informado"})`,
    )
    .join("\n");
}

const codeGeneration: Generation = {
  prompt: (state) => {
    const layer = layerToCode(state);

    if (!layer) {
      return "Não há camada pendente para implementar.";
    }

    return (
      `Projeto do aluno:\n\n${describeProject(state)}\n\n` +
      `Camadas já implementadas:\n${approvedLayers(state)}\n\n` +
      `Camada atual: ${layer.name}\n` +
      `O que ela faz: ${layer.summary}\n` +
      `Expectativa do aluno: ${layer.expectation ?? "não informada"}\n\n` +
      "Implemente apenas esta camada, sem antecipar as próximas. Responda no formato:\n\n" +
      "Arquivo: caminho/relativo/do/arquivo\n" +
      "```linguagem\n<o código completo da camada>\n```"
    );
  },
  rules:
    "escreva o código da camada atual, um arquivo por vez, no formato pedido. Não implemente camadas futuras.",
  isDone: (state) => layerToCode(state) === undefined,
  guard: checkImplementationOutput,
  apply: async (state, output, context) => {
    const layer = layerToCode(state);

    if (!layer) {
      throw new Error("Não há camada pendente para implementar.");
    }

    const parsed = parseCodeOutput(output);

    if (!parsed) {
      throw new Error(
        'A implementação não segue o formato "Arquivo: caminho" seguido de um bloco de código.',
      );
    }

    await writeLayerCode(context.projectDir, parsed.file, parsed.code);

    layer.code = parsed.code;
    layer.file = parsed.file;
    layer.approved = true;
  },
  reset: (state) => {
    const layer = currentLayer(state);

    if (!layer) return;

    delete layer.code;
    delete layer.file;
    layer.approved = false;
  },
};

export const camadaCodigoPhase: Phase = {
  id: "camada-codigo",
  title: "Código da camada",
  instruction:
    "Você implementa a camada atual do projeto em código, uma camada por vez.",
  skippable: false,
  generation: codeGeneration,
  questions: [],
  next: (state) => (currentLayer(state) ? "camada-preparo" : "entendimento"),
};
