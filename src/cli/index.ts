import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Engine, type Turn } from "../core/engine.js";
import { createLLM } from "../core/llm.js";
import { resolveSessionMenu } from "../core/sessionResolution.js";

async function main() {
  const llm = createLLM();

  console.log(`Modelo: ${llm.model}`);

  if (!(await llm.checkModel())) {
    throw new Error(
      `O modelo "${llm.model}" não está baixado. Rode: ollama pull ${llm.model}`,
    );
  }

  const projectDir = process.cwd();
  const engine = new Engine({ llm, projectDir });
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    await resolveSessionMenu(projectDir, {
      ask: (message) => rl.question(message),
      write: (message) => console.log(message),
    });

    const { resume, turn } = await engine.start();
    let current: Turn = turn;

    console.log(resume);

    while (current.kind !== "done") {
      const label = current.phaseNumber
        ? `FASE ${current.phaseNumber} [${current.phase}]`
        : `[${current.phase}]`;

      console.log(`\n${label}\n${current.text}`);

      if (current.kind === "generated" || current.kind === "notice") {
        current = await engine.next();
        continue;
      }

      const answer = await rl.question("\n> ");
      current = await engine.answer(answer);
    }

    console.log(`\n${current.text}`);
  } finally {
    rl.close();
  }
}

main().catch((error: unknown) => {
  console.error("Erro:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
