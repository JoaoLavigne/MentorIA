import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { Engine } from "../../engine.js";
import { OllamaLLM } from "../../llm.js";
import { createSession, saveSession } from "../../session.js";
import type {
  ChamadaLLM,
  MetricasChamada,
  Modo,
  Turno,
} from "../types.js";

export interface AgentAdapter {
  iniciar(opts: {
    pastaProjeto: string;
    modo: Modo;
    fase: string;
    modelo: string;
  }): Promise<void>;
  enviar(fala: string): Promise<{ resposta: string; metricas: MetricasChamada }>;
  lerEstado(): Promise<{ projetoMd: string; session: unknown }>;
  encerrar(): Promise<void>;
}

const FASES_DO_ENGINE = new Set([
  "conhecendo-dev",
  "escolha-modo",
  "ideia",
  "perguntas",
  "esboco",
  "enunciado",
  "desenho",
  "confirmacao",
  "implementacao",
  "camada-preparo",
  "camada-codigo",
  "entendimento",
]);

export function faseInicial(modo: Modo, fase: string): string {
  if (FASES_DO_ENGINE.has(fase)) return fase;
  if (modo === "algoritmo") return "enunciado";
  if (fase === "testes") return "entendimento";
  if (fase === "codificacao" || fase === "codigo") return "implementacao";

  return "conhecendo-dev";
}

async function lerArquivo(caminho: string): Promise<string | null> {
  try {
    return await readFile(caminho, "utf8");
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class EngineAgentAdapter implements AgentAdapter {
  private engine?: Engine;
  private llm?: OllamaLLM;
  private pastaProjeto?: string;
  private modelo = "";
  private chamadas: ChamadaLLM[] = [];

  async iniciar(opts: {
    pastaProjeto: string;
    modo: Modo;
    fase: string;
    modelo: string;
  }): Promise<void> {
    this.pastaProjeto = opts.pastaProjeto;
    this.modelo = opts.modelo;
    this.chamadas = [];

    const estado = createSession();
    estado.mode = opts.modo;
    estado.currentPhase = faseInicial(opts.modo, opts.fase);

    await saveSession(opts.pastaProjeto, estado);

    const llm = new OllamaLLM({ model: opts.modelo });
    this.llm = llm;
    this.engine = new Engine({ llm, projectDir: opts.pastaProjeto });
    await this.engine.start();
    await this.coletarChamadas();
  }

  async enviar(
    fala: string,
  ): Promise<{ resposta: string; metricas: MetricasChamada }> {
    if (!this.engine) {
      throw new Error("O agente não foi iniciado.");
    }

    const inicio = performance.now();
    let turn = await this.engine.answer(fala);
    let resposta = turn.text;

    while (turn.kind === "generated" || turn.kind === "notice") {
      turn = await this.engine.next();
      resposta = `${resposta}\n\n${turn.text}`;
    }

    await this.coletarChamadas();

    return {
      resposta,
      metricas: {
        tempoMs: performance.now() - inicio,
        fria: false,
      },
    };
  }

  async lerEstado(): Promise<{ projetoMd: string; session: unknown }> {
    if (!this.pastaProjeto) {
      return { projetoMd: "", session: { llmCalls: this.chamadas } };
    }

    const projetoMd =
      (await lerArquivo(join(this.pastaProjeto, "PROJETO.md"))) ?? "";
    const sessao = await lerArquivo(
      join(this.pastaProjeto, ".mentor", "session.json"),
    );
    const estado = sessao === null ? {} : (JSON.parse(sessao) as unknown);
    const session = isRecord(estado)
      ? { ...estado, llmCalls: this.chamadas }
      : { llmCalls: this.chamadas };

    return { projetoMd, session };
  }

  async encerrar(): Promise<void> {
    this.engine = undefined;
    this.llm = undefined;
    this.pastaProjeto = undefined;
    this.chamadas = [];
  }

  private async faseAtual(): Promise<string> {
    if (!this.pastaProjeto) return "desconhecida";

    const texto = await lerArquivo(
      join(this.pastaProjeto, ".mentor", "session.json"),
    );
    if (texto === null) return "desconhecida";

    try {
      const estado = JSON.parse(texto) as unknown;

      return isRecord(estado) && typeof estado.currentPhase === "string"
        ? estado.currentPhase
        : "desconhecida";
    } catch {
      return "desconhecida";
    }
  }

  private async coletarChamadas(): Promise<void> {
    if (!this.llm) return;

    const fase = await this.faseAtual();

    for (const chamada of this.llm.consumirChamadas()) {
      this.chamadas.push({
        modelo: this.modelo,
        fase,
        tokensEntrada: chamada.tokensEntrada,
        tokensSaida: chamada.tokensSaida,
        tempoMs: chamada.tempoMs,
        fria: false,
      });
    }
  }
}

export type FakeAgentOptions = {
  respostas?: string[];
  erroNaFala?: number;
  projetoMd?: string;
};

export class FakeAgent implements AgentAdapter {
  readonly turnos: Turno[] = [];
  private readonly respostas: string[];
  private readonly erroNaFala?: number;
  private pastaProjeto?: string;
  private projetoMd: string;
  private session: unknown = {};

  constructor(options: FakeAgentOptions = {}) {
    this.respostas = options.respostas ?? [];
    this.erroNaFala = options.erroNaFala;
    this.projetoMd = options.projetoMd ?? "# PROJETO\n";
  }

  async iniciar(opts: {
    pastaProjeto: string;
    modo: Modo;
    fase: string;
    modelo: string;
  }): Promise<void> {
    this.pastaProjeto = opts.pastaProjeto;
    this.session = {
      version: 1,
      mode: opts.modo,
      currentPhase: faseInicial(opts.modo, opts.fase),
    };

    await this.salvarEstado();
  }

  async enviar(
    fala: string,
  ): Promise<{ resposta: string; metricas: MetricasChamada }> {
    const indice = this.turnos.length;

    if (this.erroNaFala === indice) {
      throw new Error(`falha simulada na fala ${indice + 1}`);
    }

    const resposta =
      this.respostas[indice] ?? `Resposta simulada ${indice + 1}`;
    const metricas: MetricasChamada = { tempoMs: 0, fria: false };

    this.turnos.push({ fala, resposta, metricas });
    this.projetoMd = `${this.projetoMd}${resposta}\n`;
    await this.salvarEstado();

    return { resposta, metricas };
  }

  async lerEstado(): Promise<{ projetoMd: string; session: unknown }> {
    if (!this.pastaProjeto) {
      return { projetoMd: this.projetoMd, session: this.session };
    }

    const projetoMd = await lerArquivo(join(this.pastaProjeto, "PROJETO.md"));
    const sessao = await lerArquivo(
      join(this.pastaProjeto, ".mentor", "session.json"),
    );

    return {
      projetoMd: projetoMd ?? this.projetoMd,
      session: sessao === null ? this.session : (JSON.parse(sessao) as unknown),
    };
  }

  async encerrar(): Promise<void> {
    this.pastaProjeto = undefined;
  }

  private async salvarEstado(): Promise<void> {
    if (!this.pastaProjeto) return;

    await mkdir(join(this.pastaProjeto, ".mentor"), { recursive: true });
    await writeFile(
      join(this.pastaProjeto, ".mentor", "session.json"),
      `${JSON.stringify(this.session, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(this.pastaProjeto, "PROJETO.md"),
      this.projetoMd,
      "utf8",
    );
  }
}
