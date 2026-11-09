import type { SessionState } from "../session.js";

const ANSWER_LABELS: Record<string, string> = {
  nucleo: "Núcleo",
  entradas: "Entradas",
  processamento: "Processamento",
  saidas: "Saídas",
  criterios: "Critérios de aceitação",
};

export function describeProject(state: SessionState): string {
  const parts: string[] = [];

  if (state.idea.want) parts.push(`O que quer construir: ${state.idea.want}`);
  if (state.idea.how) parts.push(`Como imagina que funciona: ${state.idea.how}`);
  if (state.idea.dontWant) parts.push(`O que não quer: ${state.idea.dontWant}`);
  if (state.idea.success) parts.push(`Como medir o sucesso: ${state.idea.success}`);

  for (const [id, label] of Object.entries(ANSWER_LABELS)) {
    const value = state.answers[id]?.trim();
    if (value) parts.push(`${label}: ${value}`);
  }

  for (const [key, value] of Object.entries(state.architecture)) {
    if (value.trim()) parts.push(`Arquitetura "${key}": ${value.trim()}`);
  }

  if (state.edgeCases.length > 0) {
    parts.push(`Casos de borda: ${state.edgeCases.join("; ")}`);
  }

  if (state.confirmation.summary) {
    parts.push(`Resumo aprovado: ${state.confirmation.summary}`);
  }

  return parts.length > 0 ? parts.join("\n") : "Sem informações do projeto.";
}
