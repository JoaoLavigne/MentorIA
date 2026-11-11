import { gerarRelatorio } from "../report/report.js";
import { executarRodada, parseRunnerArgs } from "./runner.js";

async function main(): Promise<void> {
  const options = parseRunnerArgs(process.argv.slice(2));

  const rodada = await executarRodada({
    ...options,
    onResultado(resultado, indice, total) {
      const marca = resultado.catastrofica ? " CATASTRÓFICA" : "";
      console.log(
        `[${indice}/${total}] ${resultado.modelo} ${resultado.casoId}: nota ${resultado.nota}${marca}`,
      );
    },
  });

  const relatorio = await gerarRelatorio(rodada.arquivo);

  console.log("");
  console.log(`Rodada ${rodada.rodadaId}: ${rodada.resultados.length} caso(s).`);
  console.log(`Resultados: ${rodada.arquivo}`);
  console.log(`Relatório: ${relatorio.arquivoMd}`);
  console.log(`CSV: ${relatorio.arquivoCsv}`);
}

main().catch((error: unknown) => {
  const mensagem = error instanceof Error ? error.message : String(error);
  console.error(`Erro: ${mensagem}`);
  process.exitCode = 1;
});
