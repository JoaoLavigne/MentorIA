import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSession } from "../src/core/session.js";
import { renderProjectDoc, writeProjectDoc } from "../src/core/agentDoc.js";

const HEADINGS = [
  "## Perfil do aluno",
  "## Ideia",
  "## Respostas às perguntas",
  "## Arquitetura",
  "## Decisões",
  "## Casos de borda",
  "## Camadas implementadas e aprovações",
  "## Resultado dos testes",
  "## Entendimento",
  "## Segurança",
  "## Fechamento",
];

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "mentor-agentdoc-"));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

describe("renderProjectDoc", () => {
  it("gera todas as seções do documento vivo mesmo com sessão vazia", () => {
    const doc = renderProjectDoc(createSession());

    for (const heading of HEADINGS) {
      expect(doc).toContain(heading);
    }

    expect(doc).toContain("Fase atual: conhecendo-dev");
    expect(doc).toContain("não respondido");
  });

  it("usa as respostas do aluno sem reescrever o texto", () => {
    const session = createSession();
    session.student = {
      level: "iniciante",
      tools: ["VS Code"],
      language: "TypeScript",
    };
    session.idea.want = "um diário de estudos";
    session.answers.nucleo = "registrar o que aprendi no dia";

    const doc = renderProjectDoc(session);

    expect(doc).toContain("iniciante");
    expect(doc).toContain("VS Code");
    expect(doc).toContain("TypeScript");
    expect(doc).toContain("um diário de estudos");
    expect(doc).toContain("registrar o que aprendi no dia");
  });

  it("renderiza decisões com escolha, descarte e motivo", () => {
    const session = createSession();
    session.decisions = [
      {
        question: "Como persistir os dados?",
        chosen: "arquivo JSON",
        rejected: "banco de dados",
        reason: "simplicidade no MVP",
      },
    ];

    const doc = renderProjectDoc(session);

    expect(doc).toContain("Como persistir os dados?");
    expect(doc).toContain("arquivo JSON");
    expect(doc).toContain("banco de dados");
    expect(doc).toContain("simplicidade no MVP");
  });

  it("é idempotente para o mesmo estado", () => {
    const session = createSession();
    session.edgeCases = ["arquivo de estado corrompido"];

    expect(renderProjectDoc(session)).toBe(renderProjectDoc(session));
  });
});

describe("writeProjectDoc", () => {
  it("escreve PROJETO.md na raiz do projeto do aluno", async () => {
    const session = createSession();
    session.idea.want = "um diário de estudos";

    const file = await writeProjectDoc(projectDir, session);
    const content = await readFile(file, "utf8");

    expect(file).toBe(join(projectDir, "PROJETO.md"));
    expect(content).toContain("## Ideia");
    expect(content).toContain("um diário de estudos");
  });

  it("sobrescreve o documento com o mesmo conteúdo ao salvar de novo", async () => {
    const session = createSession();
    session.idea.want = "um diário de estudos";

    const file = await writeProjectDoc(projectDir, session);
    const first = await readFile(file, "utf8");

    await writeProjectDoc(projectDir, session);
    const second = await readFile(file, "utf8");

    expect(second).toBe(first);
  });
});
