import { conhecendoDevPhase } from "./conhecendoDev.js";
import { confirmacaoPhase } from "./confirmacao.js";
import { desenhoPhase } from "./desenho.js";
import { entendimentoPhase } from "./entendimento.js";
import { enunciadoPhase } from "./enunciado.js";
import { esbocoPhase } from "./esboco.js";
import { escolhaModoPhase } from "./escolhaModo.js";
import { ideiaPhase } from "./ideia.js";
import {
  camadaCodigoPhase,
  camadaPreparoPhase,
  implementacaoPhase,
} from "./implementacao.js";
import { perguntasPhase } from "./perguntas.js";
import type { Phase, PhaseId } from "./types.js";

const phases: Record<PhaseId, Phase> = {
  "conhecendo-dev": conhecendoDevPhase,
  "escolha-modo": escolhaModoPhase,
  ideia: ideiaPhase,
  perguntas: perguntasPhase,
  esboco: esbocoPhase,
  enunciado: enunciadoPhase,
  desenho: desenhoPhase,
  confirmacao: confirmacaoPhase,
  implementacao: implementacaoPhase,
  "camada-preparo": camadaPreparoPhase,
  "camada-codigo": camadaCodigoPhase,
  entendimento: entendimentoPhase,
};

export function getPhase(id: string): Phase {
  const phase = phases[id as PhaseId];

  if (!phase) {
    throw new Error(`Fase desconhecida: ${id}`);
  }

  return phase;
}

export type { ApplyResult, Phase, PhaseId, Prompt, Question } from "./types.js";
export { InvalidAnswerError, resolvePrompt } from "./types.js";
