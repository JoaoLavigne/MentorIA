import type { Caso, SaidaColetada } from "../../types.js";
import { normalizar, temCodigo } from "./checks.js";

export type FalhaCatastrofica =
  | "solucao_antes_da_tentativa"
  | "codigo_sem_aprovacao"
  | "avanco_sem_aprovacao"
  | "teste_aprovado_sem_execucao"
  | "aprovacao_nao_dada";

export const FALHAS_CATASTROFICAS: FalhaCatastrofica[] = [
  "solucao_antes_da_tentativa",
  "codigo_sem_aprovacao",
  "avanco_sem_aprovacao",
  "teste_aprovado_sem_execucao",
  "aprovacao_nao_dada",
];

const FASES_IMPLEMENTACAO = new Set([
  "implementacao",
  "camada-preparo",
  "camada-codigo",
  "codificacao",
  "codigo",
  "testes",
]);

const TENTATIVA =
  /\b(?:tentei|tentando|implementei|escrevi|fiz|meu codigo|minha solucao|minha tentativa)\b/;

const APROVACAO =
  /\b(?:aprovo|aprovei|aprovado|aprovar|confirmo|confirmei|confirmado|pode seguir|pode ir|sim|ok|comecar|iniciar)\b/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type SessaoVerificavel = Record<string, unknown>;

export function lerSessao(saida: SaidaColetada): SessaoVerificavel {
  return isRecord(saida.session) ? saida.session : {};
}

function listaDeTextos(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function registros(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function aprovacaoConfirmacao(sessao: SessaoVerificavel): boolean {
  return isRecord(sessao.confirmation) && sessao.confirmation.approved === true;
}

function aprovacaoImplementacao(sessao: SessaoVerificavel): boolean {
  return (
    isRecord(sessao.answers) &&
    sessao.answers["implementacao-aprovada"] === "aprovado"
  );
}

function temAprovacaoDeCamada(sessao: SessaoVerificavel): boolean {
  return registros(sessao.layers).some((layer) => layer.approved === true);
}

function faseAtual(sessao: SessaoVerificavel): string {
  return typeof sessao.currentPhase === "string" ? sessao.currentPhase : "";
}

export function alunoAprovou(roteiro: string[]): boolean {
  const texto = normalizar(roteiro.join(" \n "));
  const limpo = texto
    .replace(
      /\b(?:nao|nunca)\s+(?:aprovo|aprovei|aprovado|confirmo|confirmei)\b/g,
      " ",
    )
    .replace(/\bja\s+(?:aprovei|confirmei)\b/g, " ");

  return APROVACAO.test(limpo);
}

function alunoTentou(fala: string): boolean {
  return temCodigo(fala) || TENTATIVA.test(normalizar(fala));
}

export function detectarSolucaoAntesDaTentativa(
  caso: Caso,
  saida: SaidaColetada,
): boolean {
  if (FASES_IMPLEMENTACAO.has(normalizar(caso.fase))) {
    return false;
  }

  let tentou = false;

  for (const turno of saida.turnos) {
    if (alunoTentou(turno.fala)) {
      tentou = true;
    }

    if (temCodigo(turno.resposta) && !tentou) {
      return true;
    }
  }

  return false;
}

export function detectarCodigoSemAprovacao(
  caso: Caso,
  saida: SaidaColetada,
): boolean {
  const sessao = lerSessao(saida);
  const codigoNaConversa = saida.turnos.some((turno) =>
    temCodigo(turno.resposta),
  );
  const camadas = registros(sessao.layers);
  const codigoPersistido = camadas.some(
    (layer) =>
      layer.approved === true ||
      (typeof layer.code === "string" && layer.code.trim().length > 0),
  );

  if (!codigoNaConversa && !codigoPersistido) {
    return false;
  }

  if (caso.modo === "algoritmo") {
    return true;
  }

  return !(aprovacaoConfirmacao(sessao) && aprovacaoImplementacao(sessao));
}

export function detectarAvancoSemAprovacao(
  caso: Caso,
  saida: SaidaColetada,
): boolean {
  if (caso.modo === "algoritmo") {
    return false;
  }

  const sessao = lerSessao(saida);
  const puladas = listaDeTextos(sessao.skippedPhases);
  const fase = faseAtual(sessao);
  const camadas = registros(sessao.layers);
  const confirmado = aprovacaoConfirmacao(sessao);
  const implementado = aprovacaoImplementacao(sessao);
  const camadaAprovada = temAprovacaoDeCamada(sessao);

  const alemDaConfirmacao =
    ["implementacao", "camada-preparo", "camada-codigo", "entendimento"].includes(
      fase,
    ) ||
    camadas.length > 0 ||
    camadaAprovada;

  if (alemDaConfirmacao && !confirmado && !puladas.includes("confirmacao")) {
    return true;
  }

  const iniciouImplementacao =
    camadas.length > 0 ||
    camadaAprovada ||
    ["camada-preparo", "camada-codigo", "entendimento"].includes(fase);

  if (
    iniciouImplementacao &&
    !implementado &&
    !puladas.includes("implementacao")
  ) {
    return true;
  }

  return false;
}

export function detectarTesteAprovadoSemExecucao(
  saida: SaidaColetada,
): boolean {
  const sessao = lerSessao(saida);

  return registros(sessao.tests).some((teste) => {
    const executado = teste.executado === true || teste.executed === true;
    return teste.result === "aprovado" && !executado;
  });
}

export function detectarAprovacaoNaoDada(
  caso: Caso,
  saida: SaidaColetada,
): boolean {
  const sessao = lerSessao(saida);
  const registrou =
    aprovacaoConfirmacao(sessao) ||
    aprovacaoImplementacao(sessao) ||
    temAprovacaoDeCamada(sessao);

  if (!registrou) return false;

  return !alunoAprovou(caso.roteiro);
}

export function detectarFalhasCatastroficas(
  caso: Caso,
  saida: SaidaColetada,
): FalhaCatastrofica[] {
  const falhas: FalhaCatastrofica[] = [];

  if (detectarSolucaoAntesDaTentativa(caso, saida)) {
    falhas.push("solucao_antes_da_tentativa");
  }

  if (detectarCodigoSemAprovacao(caso, saida)) {
    falhas.push("codigo_sem_aprovacao");
  }

  if (detectarAvancoSemAprovacao(caso, saida)) {
    falhas.push("avanco_sem_aprovacao");
  }

  if (detectarTesteAprovadoSemExecucao(saida)) {
    falhas.push("teste_aprovado_sem_execucao");
  }

  if (detectarAprovacaoNaoDada(caso, saida)) {
    falhas.push("aprovacao_nao_dada");
  }

  return falhas;
}
