export type GuardResult =
  | { ok: true }
  | { ok: false; reason: string };

const CODE_PATTERNS: RegExp[] = [
  /```/,
  /^[ \t]*(?:import|export)\b[^\n]*(?:from\s*["']|["'][^"']*["']|[{*])/m,
  /^[ \t]*import\s+[\w.]+(?:\s+as\s+\w+)?[ \t]*$/m,
  /^[ \t]*from\s+[\w.]+\s+import\b/m,
  /^[ \t]*export\s+(?:default|const|let|var|function|class|async|\{)/m,
  /^[ \t]*(?:async\s+)?function\s+[\w$]+\s*\(/m,
  /^[ \t]*def\s+[\w$]+\s*\(/m,
  /^[ \t]*class\s+[\w$]+[^\n]*(?:[{(:]|extends\b)/m,
  /^[ \t]*(?:const|let|var)\s+[\w$]+\s*[=;]/m,
  /^[ \t]*(?:if|else|for|while|switch|case|try|catch)\b[^\n]*\{\s*$/m,
  /^[ \t]*\}\s*else\b[^\n]*\{\s*$/m,
  /^[ \t]*(?:return|throw|new|delete)\b[^\n]*;\s*$/m,
  /^[ \t]*(?:public|private|protected|static)\b[^\n]*[;{]/m,
  /^[ \t]*(?:int|float|double|char|bool|string)\s+[\w$]+\s*[;=]/m,
  /^[ \t]*#include\b/m,
  /^[ \t]*using\b[^\n]*;/m,
  /^[ \t]*package\s+[\w.]+\s*;/m,
  /^[ \t]*(?:\([^)]*\)|[\w$]+)\s*=>/m,
  /^[ \t]*(?:\w+[ \t]+)*\w+[ \t]*\([^)]*\)[ \t]*\{[ \t]*$/m,
];

const READY_SOLUTION =
  /\b(?:aqui est[áa] (?:o|a)|segue (?:o|a)|solu[çc][ãa]o (?:pronta|completa)|c[óo]digo (?:pronto|completo)|implementa[çc][ãa]o completa|basta copiar|cole (?:este|esse) c[óo]digo)\b/i;

export function containsCode(text: string): boolean {
  return CODE_PATTERNS.some((pattern) => pattern.test(text));
}

export function containsReadySolution(text: string): boolean {
  return containsCode(text) || READY_SOLUTION.test(text);
}

export function checkQuestionOutput(text: string): GuardResult {
  if (containsCode(text)) {
    return { ok: false, reason: "a resposta contém código" };
  }

  if (READY_SOLUTION.test(text)) {
    return { ok: false, reason: "a resposta entrega a solução pronta" };
  }

  return { ok: true };
}

export function checkDesignOutput(text: string): GuardResult {
  if (containsCode(text)) {
    return { ok: false, reason: "o desenho contém código" };
  }

  return { ok: true };
}

export function checkImplementationOutput(text: string): GuardResult {
  if (!text.trim()) {
    return { ok: false, reason: "resposta vazia" };
  }

  if (!/Arquivo:\s*\S+/i.test(text)) {
    return { ok: false, reason: 'faltou a linha "Arquivo: caminho"' };
  }

  if (!/```[^\n]*\n[\s\S]*?```/.test(text)) {
    return { ok: false, reason: "faltou o bloco de código" };
  }

  return { ok: true };
}
