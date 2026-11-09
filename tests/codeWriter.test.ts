import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CodeWriterError,
  parseCodeOutput,
  writeLayerCode,
} from "../src/core/codeWriter.js";

describe("parseCodeOutput", () => {
  it("extrai o arquivo e o código", () => {
    const parsed = parseCodeOutput(
      'Arquivo: src/main.ts\n```ts\nexport const ok = true;\n```',
    );

    expect(parsed).toEqual({
      file: "src/main.ts",
      code: "export const ok = true;",
    });
  });

  it("retorna null quando falta o arquivo", () => {
    expect(parseCodeOutput("```ts\nconst a = 1;\n```")).toBeNull();
  });

  it("retorna null quando falta o bloco de código", () => {
    expect(parseCodeOutput("Arquivo: src/main.ts")).toBeNull();
  });
});

describe("writeLayerCode", () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "mentor-writer-"));
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it("escreve o arquivo dentro do projeto criando as pastas", async () => {
    await writeLayerCode(projectDir, "src/lib/foo.ts", "export const x = 1;");

    const content = await readFile(join(projectDir, "src/lib/foo.ts"), "utf8");

    expect(content).toBe("export const x = 1;\n");
  });

  it("rejeita caminho com ..", async () => {
    await expect(
      writeLayerCode(projectDir, "../fora.ts", "const x = 1;"),
    ).rejects.toBeInstanceOf(CodeWriterError);
  });

  it("rejeita caminho absoluto", async () => {
    await expect(
      writeLayerCode(projectDir, "/tmp/fora.ts", "const x = 1;"),
    ).rejects.toBeInstanceOf(CodeWriterError);
  });
});
