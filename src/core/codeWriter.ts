import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve, sep } from "node:path";

export class CodeWriterError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CodeWriterError";
  }
}

export type CodeOutput = {
  file: string;
  code: string;
};

export function parseCodeOutput(output: string): CodeOutput | null {
  const file = output.match(/Arquivo:\s*([^\s`]+)/i)?.[1]?.trim();
  const code = output.match(/```[^\n]*\n([\s\S]*?)```/)?.[1]?.replace(/\s+$/, "");

  if (!file || !code?.trim()) return null;

  return { file, code };
}

function safeTarget(projectDir: string, file: string): string {
  const relative = file.trim().replace(/^\.\//, "");

  if (
    !relative ||
    isAbsolute(relative) ||
    relative.split(/[\\/]/).some((part) => part === "..")
  ) {
    throw new CodeWriterError(`Caminho de arquivo inválido: ${file}`);
  }

  const root = resolve(projectDir);
  const target = resolve(root, relative);

  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new CodeWriterError(`Caminho de arquivo fora do projeto: ${file}`);
  }

  return target;
}

export async function writeLayerCode(
  projectDir: string,
  file: string,
  code: string,
): Promise<string> {
  const target = safeTarget(projectDir, file);
  const content = code.endsWith("\n") ? code : `${code}\n`;

  try {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  } catch (error) {
    throw new CodeWriterError(
      `Não foi possível escrever a camada em ${file}.`,
      { cause: error },
    );
  }

  return target;
}
