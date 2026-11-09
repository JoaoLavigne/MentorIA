import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Decision, SessionState } from "./session.js";

const NOT_ANSWERED = "não respondido";

export class AgentDocError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AgentDocError";
  }
}

function text(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : NOT_ANSWERED;
}

function items(values: string[]): string {
  if (values.length === 0) return `- ${NOT_ANSWERED}`;
  return values.map((value) => `- ${value}`).join("\n");
}

function entries(record: Record<string, string>): string {
  const rows = Object.entries(record).filter(([, value]) => value.trim().length > 0);
  if (rows.length === 0) return `- ${NOT_ANSWERED}`;
  return rows.map(([key, value]) => `- **${key}:** ${value}`).join("\n");
}

function decisions(values: Decision[]): string {
  if (values.length === 0) return `- ${NOT_ANSWERED}`;

  return values
    .map(
      (value) =>
        `- **${value.question}** → ${value.chosen} (descartado: ${value.rejected}; motivo: ${value.reason})`,
    )
    .join("\n");
}

export function renderProjectDoc(state: SessionState): string {
  const mode =
    state.mode === "projeto"
      ? "criar projeto"
      : state.mode === "algoritmo"
        ? "resolver problema de estrutura de dados/algoritmos"
        : NOT_ANSWERED;

  const problem = state.problem ?? {};

  const tools =
    state.student.tools && state.student.tools.length > 0
      ? state.student.tools.join(", ")
      : NOT_ANSWERED;

  const layers =
    state.layers.length === 0
      ? `- ${NOT_ANSWERED}`
      : state.layers
          .map(
            (layer) =>
              `- **${layer.name}** — ${layer.approved ? "aprovado" : "não aprovado"}: ${layer.summary}`,
          )
          .join("\n");

  const tests =
    state.tests.length === 0
      ? `- ${NOT_ANSWERED}`
      : state.tests
          .map((test) => `- **${test.name}:** ${test.result}`)
          .join("\n");

  const closing = state.closing ?? {};

  return `# PROJETO

> Documento vivo gerado pelo Mentor a partir das respostas e decisões do aluno.
> Fase atual: ${state.currentPhase}

_Atualizado em: ${state.updatedAt}_

## Perfil do aluno

- **Nível:** ${text(state.student.level)}
- **Ferramentas:** ${tools}
- **Linguagem:** ${text(state.student.language)}
- **Experiência com IA:** ${text(state.student.aiExperience)}
- **O que quer aprender:** ${text(state.student.learningGoals)}

## Modo de trabalho

- **Modo:** ${mode}

## Problema (modo algoritmo)

- **Enunciado:** ${text(problem.statement)}
- **Desenho lógico:** ${text(problem.design)}

## Ideia

- **O que quer:** ${text(state.idea.want)}
- **Como vai ser feito:** ${text(state.idea.how)}
- **O que não quer:** ${text(state.idea.dontWant)}
- **Como medir o sucesso:** ${text(state.idea.success)}

## Respostas às perguntas

${entries(state.answers)}

## Arquitetura

${entries(state.architecture)}

## Decisões

${decisions(state.decisions)}

## Casos de borda

${items(state.edgeCases)}

## Confirmação

- **Resumo do que será implementado:** ${text(state.confirmation?.summary)}
- **Aprovado:** ${state.confirmation?.approved ? "sim" : "não"}

## Camadas implementadas e aprovações

${layers}

## Resultado dos testes

${tests}

## Entendimento

- **Status:** ${state.understanding.status}
- **Núcleo:** ${text(state.answers["entendimento-nucleo"])}
- **Arquitetura:** ${text(state.answers["entendimento-arquitetura"])}
- **Testes propostos:** ${text(state.answers["entendimento-testes"])}
- **Riscos de segurança:** ${items(state.security.findings ?? [])}
- **Regra inquebrável:** ${text(state.answers["entendimento-regra"])}
- **Observações:** ${text(state.understanding.notes)}

## Segurança

- **Mínimo necessário:** ${text(state.security.minimum)}
- **Verificações:** ${items(state.security.findings ?? [])}

## Fechamento

- **O que aprendi:** ${text(closing.learned)}
- **O que faria diferente:** ${text(closing.different)}
`;
}

export async function writeProjectDoc(
  projectDir: string,
  state: SessionState,
): Promise<string> {
  const file = join(projectDir, "PROJETO.md");

  try {
    await writeFile(file, renderProjectDoc(state), "utf8");
  } catch (error) {
    throw new AgentDocError(
      `Não foi possível escrever o documento vivo em ${file}.`,
      { cause: error },
    );
  }

  return file;
}
