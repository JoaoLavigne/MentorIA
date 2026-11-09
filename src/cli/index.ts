import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Engine, type Turn } from "../core/engine.js";
import { createLLM } from "../core/llm.js";

async function main() {
  const llm = createLLM();

  console.log(`Modelo: ${llm.model}`);

  if (!(await llm.checkModel())) {
    throw new Error(
      `O modelo "${llm.model}" não está baixado. Rode: ollama pull ${llm.model}`,
    );
  }

  const engine = new Engine({ llm, projectDir: process.cwd() });
  const { resume, turn } = await engine.start();
  const rl = createInterface({ input: stdin, output: stdout });
  let current: Turn = turn;

  console.log(resume);

  try {
    while (current.kind !== "done") {
      console.log(`\n[${current.phase}]\n${current.text}`);

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
