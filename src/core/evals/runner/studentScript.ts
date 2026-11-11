import type { Caso, SaidaColetada, Turno } from "../types.js";
import type { AgentAdapter } from "./agentAdapter.js";

export type ExecucaoRoteiro = {
  saida: SaidaColetada;
  erro?: string;
};

export type ExecutarRoteiroOptions = {
  pastaProjeto: string;
  modelo: string;
};

function mensagem(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function executarRoteiro(
  adapter: AgentAdapter,
  caso: Caso,
  opcoes: ExecutarRoteiroOptions,
): Promise<ExecucaoRoteiro> {
  const turnos: Turno[] = [];
  let erro: string | undefined;

  try {
    await adapter.iniciar({
      pastaProjeto: opcoes.pastaProjeto,
      modo: caso.modo,
      fase: caso.fase,
      modelo: opcoes.modelo,
    });

    for (const fala of caso.roteiro) {
      const { resposta, metricas } = await adapter.enviar(fala);
      turnos.push({ fala, resposta, metricas });
    }
  } catch (error) {
    erro = mensagem(error);
  }

  let projetoMd = "";
  let session: unknown = {};

  try {
    const estado = await adapter.lerEstado();
    projetoMd = estado.projetoMd;
    session = estado.session;
  } catch (error) {
    erro ??= mensagem(error);
  }

  try {
    await adapter.encerrar();
  } catch (error) {
    erro ??= mensagem(error);
  }

  return { saida: { turnos, projetoMd, session }, erro };
}
