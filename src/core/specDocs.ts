import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SessionState } from "./session.js";

const NOT_ANSWERED = "não respondido";

export class SpecDocsError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SpecDocsError";
  }
}

function text(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : NOT_ANSWERED;
}

function answer(state: SessionState, id: string): string {
  return text(state.answers[id]);
}

function items(values: string[]): string {
  if (values.length === 0) return `- ${NOT_ANSWERED}`;
  return values.map((value) => `- ${value}`).join("\n");
}

function title(state: SessionState): string {
  return text(state.idea.want);
}

function objective(state: SessionState): string {
  return text(state.idea.want);
}

function journey(state: SessionState): string {
  return text(state.architecture["jornada"]);
}

function interfaceLayout(state: SessionState): string {
  return text(state.architecture["interface"]);
}

function outOfMvp(state: SessionState): string {
  return text(state.architecture["fora-mvp"]);
}

function architecture(state: SessionState): string {
  return text(state.architecture["visao"]);
}

function tool(state: SessionState): string {
  return text(state.architecture["ferramenta"]);
}

function approved(state: SessionState): string {
  return state.confirmation?.approved ? "sim" : "não";
}

export function renderSpecDoc(state: SessionState): string {
  return `# SPEC — ${title(state)}

> Especificação técnica gerada após a aprovação na Confirmação.
> Documento complementar ao PROJETO.md e ao PRD.md.

_Atualizado em: ${state.updatedAt}_

## Objetivo

${objective(state)}

## Como deve funcionar

${text(state.idea.how)}

## Requisitos funcionais

- **Núcleo:** ${answer(state, "nucleo")}
- **Entradas:** ${answer(state, "entradas")}
- **Processamento:** ${answer(state, "processamento")}
- **Saídas:** ${answer(state, "saidas")}

## Critérios de aceitação

${answer(state, "criterios")}

## Interface e layout

${interfaceLayout(state)}

## Jornada do usuário (core journey)

${journey(state)}

## Arquitetura

${architecture(state)}

## Ferramentas

${tool(state)}

## Casos de borda

${items(state.edgeCases)}

## Fora do MVP

${outOfMvp(state)}

## Restrições

${text(state.idea.dontWant)}

## Resumo aprovado

${text(state.confirmation.summary)}
`;
}

export function renderPrdDoc(state: SessionState): string {
  return `# PRD — ${title(state)}

> Documento de produto gerado após a aprovação na Confirmação.
> Documento complementar ao PROJETO.md e ao Spec.md.

_Atualizado em: ${state.updatedAt}_

## Problema e objetivo

- **O que o usuário quer construir:** ${objective(state)}
- **Como medir o sucesso:** ${text(state.idea.success)}

## Público e jornada

${journey(state)}

## Escopo do MVP

- **Núcleo:** ${answer(state, "nucleo")}
- **Entradas:** ${answer(state, "entradas")}
- **Processamento:** ${answer(state, "processamento")}
- **Saídas:** ${answer(state, "saidas")}

## Fora do escopo (pós-MVP)

${outOfMvp(state)}

## Requisitos não funcionais

- **Linguagem:** ${text(state.student.language)}
- **Ferramenta:** ${tool(state)}
- **Arquitetura:** ${architecture(state)}
- **Interface:** ${interfaceLayout(state)}

## Casos de borda

${items(state.edgeCases)}

## Critérios de aceitação

${answer(state, "criterios")}

## Aprovação

- **Resumo do que será implementado:** ${text(state.confirmation.summary)}
- **Aprovado:** ${approved(state)}

## Documentos relacionados

- \`PROJETO.md\` — documento vivo com as respostas e decisões.
- \`Spec.md\` — especificação técnica do que será construído.
`;
}

export async function writeSpecDocs(
  projectDir: string,
  state: SessionState,
): Promise<string[]> {
  const spec = join(projectDir, "Spec.md");
  const prd = join(projectDir, "PRD.md");

  try {
    await writeFile(spec, renderSpecDoc(state), "utf8");
    await writeFile(prd, renderPrdDoc(state), "utf8");
  } catch (error) {
    throw new SpecDocsError(
      `Não foi possível escrever o Spec.md e o PRD.md em ${projectDir}.`,
      { cause: error },
    );
  }

  return [spec, prd];
}
