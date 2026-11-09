import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Engine, EngineError, type Turn } from "../src/core/engine.js";
import type { LLM, Msg } from "../src/core/llm.js";
import {
  createSession,
  loadSession,
  saveSession,
} from "../src/core/session.js";

class FakeLLM implements LLM {
  readonly model = "fake";
  readonly calls: Msg[][] = [];

  constructor(private readonly reply: (messages: Msg[]) => string) {}

  async chat(messages: Msg[]): Promise<string> {
    this.calls.push(messages);
    return this.reply(messages);
  }

  async listModels(): Promise<string[]> {
    return ["fake"];
  }

  async checkModel(): Promise<boolean> {
    return true;
  }
}

function normalLLM(): FakeLLM {
  return new FakeLLM((messages) => {
    const system = messages[0]?.content ?? "";

    if (system.includes("desenha a solução")) {
      return "Passo 1: entender o problema.\nPasso 2: percorrer de trás para frente.\nPasso 3: contar os caracteres.";
    }

    if (system.includes("resume o que será implementado")) {
      return "Resumo: um diário de estudos em TypeScript com persistência em JSON.";
    }

    if (system.includes("Proponha apenas nomes e resumos de camadas")) {
      return [
        "Camada: Núcleo",
        "Resumo: registrar um estudo em um arquivo JSON",
        "",
        "Camada: Interface",
        "Resumo: tela única com campo de texto e lista de registros",
      ].join("\n");
    }

    if (system.includes("Não implemente camadas futuras")) {
      return "Arquivo: src/index.ts\n```ts\nexport const ok = true;\n```";
    }

    const user = messages[1]?.content ?? "";
    return user.split("Pergunta-base: ")[1] ?? "Pergunta de teste?";
  });
}

function nextQuestion(turn: Turn): Extract<Turn, { kind: "question" }> {
  if (turn.kind !== "question") {
    throw new Error(`Esperava pergunta, recebi ${turn.kind}`);
  }

  return turn;
}

const PROJECT_ANSWERS = [
  "iniciante",
  "VS Code e Git",
  "TypeScript",
  "usei IA para gerar código, mas quero entender melhor",
  "arquitetura de software e boas práticas",
  "criar um projeto",
  "um diário de estudos",
  "salvar textos e consultar depois",
  "nada de login",
  "conseguir registrar o dia",
  "registrar o que estudei no dia",
  "texto digitado pelo aluno",
  "salvar em arquivo e listar depois",
  "lista de registros do dia",
  "registrar e consultar um dia sem perder dados",
  "arquivo único em JSON, sem banco, tudo no mesmo módulo",
  "validação antes de gravar no arquivo",
  "ainda não defini onde o arquivo fica salvo",
  "uma tela única com lista de registros e um campo de texto",
  "o usuário abre o app, digita o que estudou e clica em salvar; a lista mostra os registros do dia",
  "compartilhar os registros com amigos e gerar gráficos, porque o MVP é só registrar localmente",
  "se o arquivo não existir, criar um novo; se o texto estiver vazio, recusar",
  "TypeScript com Node, porque já uso",
];

async function reachConfirmation(engine: Engine): Promise<void> {
  let turn = (await engine.start()).turn;

  for (const answer of PROJECT_ANSWERS) {
    nextQuestion(turn);
    turn = await engine.answer(answer);
  }

  if (turn.kind !== "generated") {
    throw new Error(`Esperava resumo gerado, recebi ${turn.kind}`);
  }

  const question = await engine.next();
  nextQuestion(question);
}

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "mentor-engine-"));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

describe("Engine — fluxo do modo projeto", () => {
  it("conduz Conhecendo o DEV, Escolha do modo, Ideia, Perguntas, Esboço e Confirmação até o fim", async () => {
    const llm = normalLLM();
    const engine = new Engine({ llm, projectDir });
    const start = await engine.start();

    expect(start.resume).toBe("Vamos começar.");

    let turn = start.turn;

    for (const answer of PROJECT_ANSWERS) {
      expect(nextQuestion(turn).phase).toBeTruthy();
      turn = await engine.answer(answer);
    }

    expect(turn.kind).toBe("generated");
    if (turn.kind === "generated") {
      expect(turn.phase).toBe("Confirmação");
      expect(turn.text).toContain("Resumo");
    }

    turn = await engine.next();
    expect(nextQuestion(turn).phase).toBe("Confirmação");

    turn = await engine.answer("aprovar");
    expect(turn.kind).toBe("notice");
    if (turn.kind === "notice") {
      expect(turn.text).toContain("Spec.md");
      expect(turn.text).toContain("PRD.md");
      expect(turn.text).toMatch(/leia/i);
    }

    turn = await engine.next();
    expect(turn.kind).toBe("generated");
    if (turn.kind === "generated") {
      expect(turn.phase).toBe("Implementação");
      expect(turn.text).toContain("Camada: Núcleo");
    }

    turn = await engine.next();
    const planQuestion = nextQuestion(turn);
    expect(planQuestion.phase).toBe("Implementação");
    expect(planQuestion.text).toContain("aprova esta sugestão");

    turn = await engine.answer("aprovar");
    expect(nextQuestion(turn).phase).toBe("Preparo da camada");

    turn = await engine.answer("espero que grave o registro");
    expect(turn.kind).toBe("generated");
    if (turn.kind === "generated") {
      expect(turn.phase).toBe("Código da camada");
      expect(turn.text).toContain("Arquivo:");
    }

    turn = await engine.next();
    expect(nextQuestion(turn).phase).toBe("Preparo da camada");

    turn = await engine.answer("espero que mostre a lista");
    expect(turn.kind).toBe("generated");

    turn = await engine.next();
    expect(nextQuestion(turn).phase).toBe("Entendimento");

    const understanding = [
      "O núcleo lê o texto e grava no arquivo JSON.",
      "Optei por um único módulo porque o MVP é pequeno.",
      "Teste 1 grava; teste 2 lista; teste 3 recusa texto vazio.",
      "Risco de apagar o arquivo e de expor dados locais;",
      "Nunca forçar a aprovação de testes.",
    ];

    for (const answer of understanding.slice(0, -1)) {
      turn = await engine.answer(answer);
      expect(nextQuestion(turn).phase).toBe("Entendimento");
    }

    turn = await engine.answer(understanding[understanding.length - 1]);
    expect(turn.kind).toBe("done");
    if (turn.kind === "done") {
      expect(turn.text).toContain("camada");
      expect(turn.text).toContain("Entendimento concluído");
    }

    const state = await loadSession(projectDir);

    expect(state.student.level).toBe("iniciante");
    expect(state.student.tools).toEqual(["VS Code", "Git"]);
    expect(state.student.language).toBe("TypeScript");
    expect(state.student.aiExperience).toContain("usei IA");
    expect(state.student.learningGoals).toContain("arquitetura");
    expect(state.mode).toBe("projeto");
    expect(state.idea.want).toBe("um diário de estudos");
    expect(state.answers["nucleo"]).toBe("registrar o que estudei no dia");
    expect(state.architecture["visao"]).toContain("JSON");
    expect(state.architecture["interface"]).toContain("tela única");
    expect(state.architecture["jornada"]).toContain("abre o app");
    expect(state.architecture["fora-mvp"]).toContain("compartilhar");
    expect(state.architecture["ferramenta"]).toContain("TypeScript");
    expect(state.edgeCases).toContain(
      "se o arquivo não existir, criar um novo; se o texto estiver vazio, recusar",
    );
    expect(state.confirmation.approved).toBe(true);
    expect(state.confirmation.summary).toContain("Resumo");
    expect(state.currentPhase).toBe("entendimento");
    expect(state.layers).toHaveLength(2);
    expect(state.layers.every((layer) => layer.approved)).toBe(true);
    expect(state.layers[0].file).toBe("src/index.ts");
    expect(state.layers[0].expectation).toBe("espero que grave o registro");
    expect(state.understanding.status).toBe("concluido");
    expect(state.answers["entendimento-nucleo"]).toContain("núcleo");
    expect(state.answers["entendimento-arquitetura"]).toContain("módulo");
    expect(state.answers["entendimento-testes"]).toContain("Teste 1");
    expect(state.security.findings).toEqual([
      "Risco de apagar o arquivo e de expor dados locais",
    ]);
    expect(state.answers["entendimento-regra"]).toContain("Nunca forçar");

    const code = await readFile(join(projectDir, "src/index.ts"), "utf8");
    expect(code).toContain("export const ok = true;");

    expect(
      llm.calls.some((messages) =>
        (messages[1]?.content ?? "").includes("um diário de estudos"),
      ),
    ).toBe(true);

    const doc = await readFile(join(projectDir, "PROJETO.md"), "utf8");
    expect(doc).toContain("criar projeto");
    expect(doc).toContain("usei IA para gerar código");
    expect(doc).toContain("arquitetura de software e boas práticas");
    expect(doc).toContain("um diário de estudos");
    expect(doc).toContain("registrar o que estudei no dia");
    expect(doc).toContain("arquivo único em JSON");
    expect(doc).toContain("uma tela única com lista de registros");
    expect(doc).toContain("o usuário abre o app");
    expect(doc).toContain("compartilhar os registros com amigos");
    expect(doc).toContain("TypeScript com Node");
    expect(doc).toContain("se o arquivo não existir");
    expect(doc).toContain("Aprovado:** sim");
  });

  it("retoma a sessão salva", async () => {
    const first = new Engine({ llm: normalLLM(), projectDir });
    const start = await first.start();
    await first.answer("iniciante");

    const second = new Engine({ llm: normalLLM(), projectDir });
    const resumed = await second.start();

    expect(resumed.resume).toContain("Conhecendo o DEV");
    expect(nextQuestion(resumed.turn).text).toContain("ferramentas");
  });
});

describe("Engine — confirmação", () => {
  it("permite alterar uma resposta e voltar para a confirmação", async () => {
    const engine = new Engine({ llm: normalLLM(), projectDir });
    await reachConfirmation(engine);

    let turn = await engine.answer("alterar nucleo");

    const question = nextQuestion(turn);
    expect(question.phase).toBe("Perguntas");
    expect(question.text).toContain("núcleo");

    turn = await engine.answer("um catálogo de exercícios");

    expect(turn.kind).toBe("generated");

    turn = await engine.next();
    expect(nextQuestion(turn).phase).toBe("Confirmação");

    turn = await engine.answer("aprovar");
    expect(turn.kind).toBe("notice");

    turn = await engine.next();
    expect(turn.kind).toBe("generated");

    turn = await engine.next();
    nextQuestion(turn);

    turn = await engine.answer("pular");
    expect(turn.kind).toBe("done");

    const state = await loadSession(projectDir);
    expect(state.answers["nucleo"]).toBe("um catálogo de exercícios");
    expect(state.confirmation.approved).toBe(true);
    expect(state.skippedPhases).toContain("implementacao");
  });

  it("permite refazer uma fase inteira", async () => {
    const engine = new Engine({ llm: normalLLM(), projectDir });
    await reachConfirmation(engine);

    const turn = await engine.answer("refazer ideia");

    const question = nextQuestion(turn);
    expect(question.phase).toBe("Ideia");
    expect(question.text).toContain("O que você quer construir");

    const state = await loadSession(projectDir);
    expect(state.idea.want).toBeUndefined();
    expect(state.answers["ideia-want"]).toBeUndefined();
  });

  it("repete a confirmação quando o comando não é entendido", async () => {
    const engine = new Engine({ llm: normalLLM(), projectDir });
    await reachConfirmation(engine);

    const turn = await engine.answer("talvez");

    expect(turn.kind).toBe("question");
    if (turn.kind === "question") {
      expect(turn.phase).toBe("Confirmação");
      expect(turn.text).toContain("Não entendi");
    }

    expect(
      (await loadSession(projectDir)).confirmation.approved,
    ).toBeUndefined();
  });

  it("cria Spec.md e PRD.md só depois da aprovação e avisa o aluno", async () => {
    const engine = new Engine({ llm: normalLLM(), projectDir });
    await reachConfirmation(engine);

    await expect(readFile(join(projectDir, "Spec.md"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });

    let turn = await engine.answer("aprovar");
    expect(turn.kind).toBe("notice");
    if (turn.kind === "notice") {
      expect(turn.text).toContain("Spec.md");
      expect(turn.text).toContain("PRD.md");
      expect(turn.text).toMatch(/leia/i);
    }

    turn = await engine.next();
    expect(turn.kind).toBe("generated");

    turn = await engine.next();
    nextQuestion(turn);

    turn = await engine.answer("pular");
    expect(turn.kind).toBe("done");
    if (turn.kind === "done") {
      expect(turn.text).toContain("Spec.md");
      expect(turn.text).toContain("PRD.md");
      expect(turn.text).toContain("alinhamento");
    }

    const spec = await readFile(join(projectDir, "Spec.md"), "utf8");
    const prd = await readFile(join(projectDir, "PRD.md"), "utf8");

    expect(spec).toContain("Especificação técnica");
    expect(spec).toContain("registrar o que estudei no dia");
    expect(spec).toContain("uma tela única");
    expect(prd).toContain("Documento de produto");
    expect(prd).toContain("Fora do escopo");
    expect(prd).toContain("compartilhar os registros com amigos");
  });
});

describe("Engine — explicação dos modos", () => {
  it("explica projeto e algoritmo antes de escolher o modo", async () => {
    const engine = new Engine({ llm: normalLLM(), projectDir });
    let turn = (await engine.start()).turn;

    for (const answer of [
      "iniciante",
      "VS Code",
      "TypeScript",
      "usei IA para gerar código",
      "arquitetura e boas práticas",
    ]) {
      turn = await engine.answer(answer);
    }

    const question = nextQuestion(turn);

    expect(question.phase).toBe("Escolha do modo");
    expect(question.text).toContain("Criar um projeto");
    expect(question.text).toContain("algoritmo/estrutura de dados");
  });
});

describe("Engine — pular fase", () => {
  it("pula a fase atual quando o aluno digita pular", async () => {
    const engine = new Engine({ llm: normalLLM(), projectDir });
    let turn = (await engine.start()).turn;

    turn = await engine.answer("pular");

    expect(nextQuestion(turn).phase).toBe("Escolha do modo");

    const state = await loadSession(projectDir);
    expect(state.skippedPhases).toContain("conhecendo-dev");
    expect(state.student).toEqual({});
  });

  it("pula a fase de ideia no modo projeto", async () => {
    const engine = new Engine({ llm: normalLLM(), projectDir });
    let turn = (await engine.start()).turn;

    for (const answer of [
      "iniciante",
      "VS Code",
      "TypeScript",
      "usei IA para gerar código",
      "arquitetura e boas práticas",
      "criar um projeto",
    ]) {
      turn = await engine.answer(answer);
    }

    expect(nextQuestion(turn).phase).toBe("Ideia");

    turn = await engine.answer("pular");

    expect(nextQuestion(turn).phase).toBe("Perguntas");

    const state = await loadSession(projectDir);
    expect(state.skippedPhases).toContain("ideia");
    expect(state.idea).toEqual({});
  });

  it("pula o enunciado sem gerar desenho lógico", async () => {
    const engine = new Engine({ llm: normalLLM(), projectDir });
    let turn = (await engine.start()).turn;

    for (const answer of [
      "iniciante",
      "nenhuma",
      "Python",
      "usei IA para gerar código",
      "arquitetura e boas práticas",
      "resolver um problema de algoritmo",
    ]) {
      turn = await engine.answer(answer);
    }

    expect(nextQuestion(turn).phase).toBe("Enunciado");

    turn = await engine.answer("pular");

    expect(turn.kind).toBe("done");

    const state = await loadSession(projectDir);
    expect(state.skippedPhases).toContain("enunciado");
    expect(state.problem.statement).toBeUndefined();
    expect(state.problem.design).toBeUndefined();
  });
});

describe("Engine — modo algoritmo", () => {
  it("coleta o enunciado e gera o desenho lógico sem código", async () => {
    const engine = new Engine({ llm: normalLLM(), projectDir });
    let turn = (await engine.start()).turn;

    for (const answer of [
      "iniciante",
      "nenhuma",
      "Python",
      "usei IA para gerar código",
      "arquitetura e boas práticas",
      "resolver um problema de estrutura de dados",
    ]) {
      turn = await engine.answer(answer);
    }

    expect(nextQuestion(turn).phase).toBe("Enunciado");

    turn = await engine.answer("Dado um array de inteiros, retorne a soma.");

    expect(turn.kind).toBe("generated");
    if (turn.kind === "generated") {
      expect(turn.text).toContain("Passo 1");
    }

    const state = await loadSession(projectDir);
    expect(state.mode).toBe("algoritmo");
    expect(state.problem.statement).toContain("array de inteiros");
    expect(state.problem.design).toContain("Passo 1");

    const done = await engine.next();
    expect(done.kind).toBe("done");
  });
});

describe("Engine — entendimento", () => {
  it("registra o Entendimento como pulado quando o aluno digita pular", async () => {
    const session = createSession();
    session.mode = "projeto";
    session.confirmation = { approved: true, summary: "Resumo aprovado" };
    session.layers = [
      {
        name: "Núcleo",
        summary: "registrar estudos",
        approved: true,
        file: "src/index.ts",
      },
    ];
    session.currentPhase = "entendimento";
    await saveSession(projectDir, session);

    const engine = new Engine({ llm: normalLLM(), projectDir });
    let turn = (await engine.start()).turn;

    expect(turn.kind).toBe("notice");

    turn = await engine.next();
    expect(nextQuestion(turn).phase).toBe("Entendimento");

    turn = await engine.answer("pular");
    expect(turn.kind).toBe("done");
    if (turn.kind === "done") {
      expect(turn.text).toContain("Entendimento foi pulado");
    }

    const state = await loadSession(projectDir);
    expect(state.understanding.status).toBe("pulado");
    expect(state.skippedPhases).toContain("entendimento");

    const doc = await readFile(join(projectDir, "PROJETO.md"), "utf8");
    expect(doc).toContain("## Entendimento");
    expect(doc).toContain("pulado");
  });
});

describe("Engine — validação", () => {
  it("repete a escolha do modo quando a resposta é ambígua", async () => {
    const engine = new Engine({ llm: normalLLM(), projectDir });
    let turn = (await engine.start()).turn;

    for (const answer of [
      "iniciante",
      "VS Code",
      "TypeScript",
      "usei IA para gerar código",
      "arquitetura e boas práticas",
    ]) {
      turn = await engine.answer(answer);
    }

    turn = await engine.answer("talvez");

    expect(turn.kind).toBe("question");
    if (turn.kind === "question") {
      expect(turn.text).toContain("Não entendi o modo");
    }
    expect((await loadSession(projectDir)).mode).toBeUndefined();

    turn = await engine.answer("criar um projeto");
    expect(nextQuestion(turn).phase).toBe("Ideia");
  });

  it("rejeita resposta vazia e mantém a mesma fase", async () => {
    const engine = new Engine({ llm: normalLLM(), projectDir });
    const start = await engine.start();

    const empty = await engine.answer("   ");
    expect(empty.kind).toBe("question");
    if (empty.kind === "question") {
      expect(empty.text).toContain("resposta vazia não é aceita");
      expect(empty.phase).toBe(nextQuestion(start.turn).phase);
    }

    const next = await engine.answer("iniciante");
    expect(nextQuestion(next).text).toContain("ferramentas");
  });

  it("usa a pergunta-base quando o modelo tenta entregar código", async () => {
    const codeLLM = new FakeLLM(() => "```js\nconst resposta = 1;\n```");
    const engine = new Engine({ llm: codeLLM, projectDir });

    const start = await engine.start();
    const turn = nextQuestion(start.turn);

    expect(turn.text).toContain("nível de experiência");
    expect(codeLLM.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("não grava desenho lógico quando o modelo insiste em código", async () => {
    const codeLLM = new FakeLLM(() => "```js\nfunction f() {}\n```");
    const engine = new Engine({ llm: codeLLM, projectDir });
    let turn = (await engine.start()).turn;

    for (const answer of [
      "iniciante",
      "nenhuma",
      "Python",
      "usei IA para gerar código",
      "arquitetura e boas práticas",
      "resolver um problema de algoritmo",
    ]) {
      turn = await engine.answer(answer);
    }

    await expect(engine.answer("Some dois números.")).rejects.toBeInstanceOf(
      EngineError,
    );

    const state = await loadSession(projectDir);
    expect(state.problem.statement).toBe("Some dois números.");
    expect(state.problem.design).toBeUndefined();
  });
});
