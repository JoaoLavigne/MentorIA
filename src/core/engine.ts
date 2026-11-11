import { basename } from "node:path";
import { writeProjectDoc } from "./agentDoc.js";
import {
  checkAlgorithmOutput,
  checkDesignOutput,
  checkQuestionOutput,
} from "./guards.js";
import { writeSpecDocs } from "./specDocs.js";
import type { LLM, Msg } from "./llm.js";
import {
  getPhase,
  InvalidAnswerError,
  phaseNumber,
  resolvePrompt,
  type ApplyResult,
  type Phase,
  type PhaseId,
  type Question,
} from "./phases/index.js";
import { loadSession, saveSession, type SessionState } from "./session.js";

export type Turn =
  | { kind: "question"; phase: string; phaseNumber?: number; text: string }
  | { kind: "generated"; phase: string; phaseNumber?: number; text: string }
  | { kind: "notice"; phase: string; phaseNumber?: number; text: string }
  | { kind: "done"; text: string };

export type EngineStart = {
  resume: string;
  turn: Turn;
};

export type EngineDeps = {
  llm: LLM;
  projectDir: string;
  load?: (projectDir: string) => Promise<SessionState>;
  save?: (projectDir: string, state: SessionState) => Promise<void>;
  writeDoc?: (projectDir: string, state: SessionState) => Promise<string>;
  writeSpecDocs?: (
    projectDir: string,
    state: SessionState,
  ) => Promise<string[]>;
};

type PendingQuestion = {
  phaseId: PhaseId;
  questionId: string;
};

const SKIP_ANSWER = /^pular$/i;
const SKIP_HINT = 'Digite "pular" para pular esta fase.';

export class EngineError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "EngineError";
  }
}

function context(state: SessionState): string {
  const parts: string[] = [];

  if (state.student.level) parts.push(`Nível: ${state.student.level}`);
  if (state.student.language) parts.push(`Linguagem: ${state.student.language}`);
  if (state.student.tools?.length) {
    parts.push(`Ferramentas: ${state.student.tools.join(", ")}`);
  }
  if (state.student.aiExperience) {
    parts.push(`Experiência com IA: ${state.student.aiExperience}`);
  }
  if (state.student.learningGoals) {
    parts.push(`Objetivos de aprendizado: ${state.student.learningGoals}`);
  }
  if (state.mode) parts.push(`Modo escolhido: ${state.mode}`);

  const idea = state.idea ?? {};
  if (idea.want) parts.push(`O que quer construir: ${idea.want}`);
  if (idea.how) parts.push(`Como imagina que funciona: ${idea.how}`);
  if (idea.dontWant) parts.push(`O que não quer: ${idea.dontWant}`);
  if (idea.success) parts.push(`Como medir o sucesso: ${idea.success}`);

  for (const [id, value] of Object.entries(state.answers ?? {})) {
    if (value.trim()) parts.push(`Resposta "${id}": ${value}`);
  }

  for (const [key, value] of Object.entries(state.architecture ?? {})) {
    if (value.trim()) parts.push(`Arquitetura "${key}": ${value}`);
  }

  for (const [index, layer] of state.layers.entries()) {
    const status = layer.approved ? "aprovada" : "pendente";
    parts.push(
      `Camada ${index + 1}: ${layer.name} — ${layer.summary} (${status})${layer.file ? `, arquivo ${layer.file}` : ""}`,
    );
    if (layer.expectation) {
      parts.push(`Expectativa do aluno para a camada ${index + 1}: ${layer.expectation}`);
    }
  }

  return parts.length > 0 ? parts.join("\n") : "Ainda não há informações do aluno.";
}

function doneText(state: SessionState): string {
  if (state.mode === "algoritmo") {
    return "Enunciado registrado e desenho lógico concluído. A implementação fica para a próxima camada.";
  }

  if (
    state.layers.length > 0 &&
    state.layers.every((layer) => layer.approved)
  ) {
    const base = `Implementação em camadas concluída: ${state.layers.length} camada(s) aprovada(s) e gravada(s) na pasta do projeto. Leia o Spec.md e o PRD.md para maximizar o alinhamento com o que foi construído.`;

    if (state.understanding.status === "pulado") {
      return `${base} O Entendimento foi pulado e registrado no PROJETO.md.`;
    }

    if (state.understanding.status === "concluido") {
      return `${base} Entendimento concluído: o aluno explicou o núcleo, justificou a arquitetura, propôs testes, apontou riscos de segurança e citou a regra inquebrável.`;
    }

    return base;
  }

  if (state.skippedPhases.includes("implementacao")) {
    return "Projeto aprovado na Confirmação, mas a Implementação em camadas foi pulada. O Spec.md e o PRD.md foram criados; leia os dois para maximizar o alinhamento antes de implementar.";
  }

  if (state.confirmation?.approved) {
    return "Projeto aprovado na Confirmação. Criei o Spec.md e o PRD.md na pasta do projeto, além de atualizar o PROJETO.md. Leia o Spec.md e o PRD.md para maximizar o alinhamento antes de implementar.";
  }

  return "Esboço concluído sem aprovação do projeto. O PROJETO.md foi atualizado.";
}

function resumeHint(state: SessionState): string {
  const answered = Object.keys(state.answers).length;

  if (answered === 0) return "Vamos começar.";

  const phase = getPhase(state.currentPhase);
  return `Retomando em FASE ${phaseNumber(phase.id, state.mode)} [${phase.title}].`;
}

export class Engine {
  private readonly deps: Required<EngineDeps>;
  private state?: SessionState;
  private pending: PendingQuestion | null = null;
  private initialized = false;
  private specDocsWritten = false;
  private notice: string | null = null;

  constructor(deps: EngineDeps) {
    this.deps = {
      load: loadSession,
      save: saveSession,
      writeDoc: writeProjectDoc,
      writeSpecDocs,
      ...deps,
    };
  }

  async start(): Promise<EngineStart> {
    await this.init();
    await this.persist();

    return {
      resume: resumeHint(this.state!),
      turn: await this.computeNext(),
    };
  }

  async next(): Promise<Turn> {
    await this.init();
    return this.computeNext();
  }

  async answer(input: string): Promise<Turn> {
    await this.init();

    if (!this.pending) {
      throw new EngineError("Não há pergunta pendente para responder.");
    }

    const pending = this.pending;
    const phase = getPhase(pending.phaseId);
    const question = phase.questions.find((item) => item.id === pending.questionId);

    if (!question) {
      throw new EngineError(`Pergunta desconhecida: ${pending.questionId}`);
    }

    const value = input.trim();

    if (value.length === 0) {
      return this.reask("resposta vazia não é aceita");
    }

    if (phase.skippable !== false && SKIP_ANSWER.test(value)) {
      this.skipPhase(pending.phaseId);
      this.pending = null;

      await this.persist();
      return this.computeNext();
    }

    let result: ApplyResult | void;

    try {
      result = question.apply(this.state!, value);
    } catch (error) {
      if (error instanceof InvalidAnswerError) {
        return this.reask(error.message);
      }

      throw error;
    }

    if (result && result.handled) {
      this.pending = null;

      await this.persist();
      return this.computeNext();
    }

    if (!question.isAnswered(this.state!)) {
      throw new EngineError(
        `A resposta não preencheu a pergunta "${question.id}".`,
      );
    }

    this.state!.answers[question.id] = value;
    this.pending = null;

    await this.persist();
    return this.computeNext();
  }

  private async init(): Promise<void> {
    if (this.initialized) return;

    this.state = await this.deps.load(this.deps.projectDir);
    this.initialized = true;
  }

  private async persist(): Promise<void> {
    this.state!.updatedAt = new Date().toISOString();
    await this.deps.save(this.deps.projectDir, this.state!);
    await this.deps.writeDoc(this.deps.projectDir, this.state!);

    if (this.state!.confirmation?.approved && !this.specDocsWritten) {
      const files = await this.deps.writeSpecDocs(
        this.deps.projectDir,
        this.state!,
      );
      this.specDocsWritten = true;
      const names = files.map((file) => basename(file));

      this.notice =
        `Criei ${names.join(" e ")} na pasta do projeto.\n` +
        "Leia esses documentos antes da implementação para maximizar o alinhamento com o que será construído.";
    }
  }

  private skipPhase(phaseId: PhaseId): void {
    if (!this.state!.skippedPhases.includes(phaseId)) {
      this.state!.skippedPhases.push(phaseId);
    }
  }

  private reask(message: string): Turn {
    if (!this.pending) {
      throw new EngineError(message);
    }

    const phase = getPhase(this.pending.phaseId);
    const question = phase.questions.find(
      (item) => item.id === this.pending!.questionId,
    );

    if (!question) {
      throw new EngineError(`Pergunta desconhecida: ${this.pending.questionId}`);
    }

    const hint = phase.skippable === false ? "" : `\n\n${SKIP_HINT}`;

    return {
      kind: "question",
      phase: phase.title,
      phaseNumber: phaseNumber(phase.id, this.state!.mode),
      text: `${message}\n\n${resolvePrompt(question.prompt, this.state!)}${hint}`,
    };
  }

  private async computeNext(): Promise<Turn> {
    if (this.notice) {
      const text = this.notice;
      this.notice = null;
      return { kind: "notice", phase: "Documentos", text };
    }

    for (let step = 0; step < 20; step += 1) {
      const state = this.state!;
      const phase = getPhase(state.currentPhase);

      if (state.skippedPhases.includes(phase.id)) {
        const next = phase.next(state);

        if (!next) {
          await this.persist();
          return { kind: "done", text: doneText(state) };
        }

        state.currentPhase = next;
        await this.persist();
        continue;
      }

      if (phase.generation && !phase.generation.isDone(state)) {
        const output = await this.generate(phase);
        await phase.generation.apply(state, output, {
          projectDir: this.deps.projectDir,
        });
        this.pending = null;
        await this.persist();

        return {
          kind: "generated",
          phase: phase.title,
          phaseNumber: phaseNumber(phase.id, state.mode),
          text: output,
        };
      }

      const question = phase.questions.find((item) => !item.isAnswered(state));

      if (question) {
        this.pending = { phaseId: phase.id, questionId: question.id };
        const text = await this.ask(phase, question);
        const withIntro =
          phase.intro && phase.questions[0] === question
            ? `${phase.intro}\n\n${text}`
            : text;
        const hint = phase.skippable === false ? "" : `\n\n${SKIP_HINT}`;

        return {
          kind: "question",
          phase: phase.title,
          phaseNumber: phaseNumber(phase.id, state.mode),
          text: `${withIntro}${hint}`,
        };
      }

      const next = phase.next(state);

      if (!next) {
        await this.persist();
        return { kind: "done", text: doneText(state) };
      }

      state.currentPhase = next;
      await this.persist();
    }

    throw new EngineError("O fluxo entrou em um ciclo sem avançar de fase.");
  }

  private async ask(phase: Phase, question: Question): Promise<string> {
    const prompt = resolvePrompt(question.prompt, this.state!);
    const guard =
      this.state!.mode === "algoritmo"
        ? checkAlgorithmOutput
        : checkQuestionOutput;
    const messages: Msg[] = [
      {
        role: "system",
        content: `${phase.instruction}\n\nRegras: faça exatamente uma pergunta por vez. Não entregue a resposta, não escreva código e não responda pelo aluno. Use no máximo duas frases.`,
      },
      {
        role: "user",
        content: `Contexto do aluno:\n${context(this.state!)}\n\nPergunta-base: ${prompt}\n\nReescreva a pergunta-base mantendo o mesmo objetivo.`,
      },
    ];

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const output = (await this.deps.llm.chat(messages)).trim();
      const check = guard(output);

      if (check.ok && output.length > 0) {
        return output;
      }

      messages.push(
        { role: "assistant", content: output },
        {
          role: "user",
          content: `Sua resposta foi rejeitada: ${check.ok ? "resposta vazia" : check.reason}. Gere apenas a pergunta, sem código e sem a solução.`,
        },
      );
    }

    return prompt;
  }

  private async generate(phase: Phase): Promise<string> {
    const generation = phase.generation;

    if (!generation) {
      throw new EngineError(`A fase "${phase.id}" não gera conteúdo.`);
    }

    const rules =
      generation.rules ??
      "não escreva código, não use blocos de código e não implemente a solução. Descreva apenas a lógica em passos.";
    const guard =
      this.state!.mode === "algoritmo"
        ? checkAlgorithmOutput
        : (generation.guard ?? checkDesignOutput);
    const messages: Msg[] = [
      { role: "system", content: `${phase.instruction}\n\nRegras: ${rules}` },
      { role: "user", content: generation.prompt(this.state!) },
    ];

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const output = (await this.deps.llm.chat(messages)).trim();
      const check = guard(output);

      if (check.ok && output.length > 0) {
        return output;
      }

      messages.push(
        { role: "assistant", content: output },
        {
          role: "user",
          content: `Sua resposta foi rejeitada: ${check.ok ? "resposta vazia" : check.reason}. Gere novamente seguindo as regras.`,
        },
      );
    }

    throw new EngineError(
      `Não consegui gerar uma resposta válida para a fase "${phase.title}" depois de duas tentativas.`,
    );
  }
}
