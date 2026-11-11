export type Modo = "projeto" | "algoritmo";
export type Categoria =
  | "accuracy"
  | "casos_de_borda"
  | "relevance"
  | "robustness";
export type Slot =
  | "nucleo"
  | "entradas"
  | "processamento"
  | "saidas"
  | "criterios";

export interface CasoBase {
  id: string;
  categoria: Categoria;
  modo: Modo;
  fase: string;
  roteiro: string[];
  obs?: string;
}

export interface CasoAccuracy extends CasoBase {
  categoria: "accuracy";
  esperado: {
    projetoMd?: Record<string, string[]>;
    algoritmoMd?: Record<string, string[]>;
    naoDeveConter: string[];
    session: { modo: Modo; fase: string };
    aprovacoes: string[];
  };
}

export interface CasoBorda extends CasoBase {
  categoria: "casos_de_borda";
  spec: string;
  lacunas: { id: string; descricao: string; termos: string[] }[];
  minLacunas: number;
  proibidoAssumir: string[];
}

export interface CasoRelevance extends CasoBase {
  categoria: "relevance";
  slotPendente: Slot;
}

export interface CasoRobustness extends CasoBase {
  categoria: "robustness";
  esperado: {
    semCodigo?: boolean;
    maxPerguntas?: number;
    faseFinal?: string;
    modoFinal?: Modo;
  };
}

export type Caso = CasoAccuracy | CasoBorda | CasoRelevance | CasoRobustness;

export interface MetricasChamada {
  tokensEntrada?: number;
  tokensSaida?: number;
  tempoMs: number;
  fria: boolean;
}

export type ChamadaLLM = {
  modelo: string;
  fase: string;
  tokensEntrada: number;
  tokensSaida: number;
  tempoMs: number;
  fria: boolean;
};

export interface Turno {
  fala: string;
  resposta: string;
  metricas: MetricasChamada;
}

export interface SaidaColetada {
  turnos: Turno[];
  projetoMd: string;
  session: unknown;
}

export interface ResultadoAvaliacao {
  nota: 0 | 1 | 2;
  catastrofica: boolean;
  motivo: string;
  detalhes?: Record<string, unknown>;
}

export interface Evaluator<C extends Caso> {
  categoria: C["categoria"];
  avaliar(caso: C, saida: SaidaColetada): ResultadoAvaliacao;
}

export interface ResultadoCaso {
  casoId: string;
  categoria: Categoria;
  modelo: string;
  repeticao: number;
  nota: 0 | 1 | 2;
  catastrofica: boolean;
  motivo: string;
  metricas: {
    tokensEntrada: number;
    tokensSaida: number;
    tempoMs: number;
    fria: boolean;
  };
  chamadas?: ChamadaLLM[];
}
