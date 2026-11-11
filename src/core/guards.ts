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

const STRONG_CODE_LINE: RegExp[] = [
  /^(?:const|let|var)\s+[\w$]/,
  /^(?:import|export)\s+(?:\{|[A-Za-z_$][\w.$]*\s*(?:,|$|from\b|as\b|;))/,
  /^import\s+["']/,
  /^return\b.*;\s*$/,
  /^(?:async\s+)?function\s+[\w$]+\s*\(/,
  /^def\s+[\w$]+\s*\(/,
  /^class\s+[\w$]+[^\n]*(?:[{(:]|extends\b)/,
  /^(?:public|private|protected|static)\b[^\n]*[;{]/,
  /^(?:int|float|double|char|bool|string|long|short|unsigned)\s+[\w$]+\s*(?:=|;|\[)/,
  /^#include\b/,
  /^using\b[^\n]*;/,
  /^package\s+[\w.]+\s*;/,
  /^(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/,
  /^[A-Za-z_$][\w$.]*\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/,
  /^[A-Za-z_$][\w$.]*\s*(?:=|\+=|-=|\*=|\/=)\s*\S/,
  /^(?:if|else|for|while|switch|case|try|catch|finally)\b[^\n]*\{\s*$/,
  /^[{}]\s*$/,
];

const WEAK_CODE_LINE: RegExp[] = [
  /^(?:SELECT\b.*\bFROM\b|INSERT\s+INTO\b|UPDATE\b.*\bSET\b|DELETE\s+FROM\b|CREATE\s+(?:TABLE|INDEX|DATABASE)\b|DROP\s+TABLE\b|ALTER\s+TABLE\b)/i,
  /^(?:\$|sudo\b|npm\b|npx\b|yarn\b|pnpm\b|git\b|curl\b|pip\b)/,
  /\bprint\s*\(/,
  /\bconsole\.log\s*\(/,
];

const FENCED_BLOCK = /```([\s\S]*?)```/g;

function normalizeCodeLine(line: string): string {
  return line
    .replace(/^\s*(?:>\s*)?(?:[-*+]\s+|\d+[.)]\s+)?/, "")
    .trimEnd();
}

function codeLineWeight(line: string): number {
  if (!line.trim()) return 0;
  if (STRONG_CODE_LINE.some((pattern) => pattern.test(line))) return 1;
  if (WEAK_CODE_LINE.some((pattern) => pattern.test(line))) return 0.5;
  return 0;
}

function hasFencedCode(text: string): boolean {
  for (const match of text.matchAll(FENCED_BLOCK)) {
    if (match[1].trim()) return true;
  }

  return false;
}

export function checkAlgorithmOutput(text: string): GuardResult {
  const findings: { line: string; weight: number }[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = normalizeCodeLine(raw);
    const weight = codeLineWeight(line);

    if (weight > 0) {
      findings.push({ line: line.trim(), weight });
    }
  }

  const fenced = hasFencedCode(text);
  const score = findings.reduce((total, finding) => total + finding.weight, 0);

  if (!fenced && score < 2) {
    return { ok: true };
  }

  const severity = fenced ? Math.max(score, 2) : score;
  const detected = findings
    .map((finding) => `"${finding.line}" (${finding.weight})`)
    .join("; ");
  const block = fenced ? " Bloco cercado por ``` detectado." : "";
  const lines = detected ? ` Linhas detectadas: ${detected}.` : "";

  return {
    ok: false,
    reason:
      `sua resposta contém código; reescreva só com explicação em texto, sem código` +
      ` (gravidade ${severity}, limite 2).${block}${lines}`,
  };
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
