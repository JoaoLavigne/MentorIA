const STRONG_CODE_PATTERNS: RegExp[] = [
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
  /^(?:SELECT\b.*\bFROM\b|INSERT\s+INTO\b|UPDATE\b.*\bSET\b|DELETE\s+FROM\b)/i,
  /^(?:\$|sudo\b|npm\b|npx\b|yarn\b|pnpm\b|git\b|curl\b|pip\b)/,
];

const INLINE_CODE_PATTERNS: RegExp[] = [
  /\bprint\s*\(/,
  /\bconsole\.log\s*\(/,
  /\bprintf\s*\(/,
  /\bSystem\.out\.println\s*\(/,
];

const FENCED_BLOCK = /```([\s\S]*?)```/g;

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function contarPerguntas(texto: string): number {
  return (texto.match(/\?+/g) ?? []).length;
}

function normalizeLine(line: string): string {
  return line
    .replace(/^\s*(?:>\s*)?(?:[-*+]\s+|\d+[.)]\s+)?/, "")
    .trim();
}

export function temCodigo(texto: string): boolean {
  for (const match of texto.matchAll(FENCED_BLOCK)) {
    if (match[1].trim().length > 0) return true;
  }

  for (const raw of texto.split(/\r?\n/)) {
    const linha = normalizeLine(raw);

    if (linha.length === 0) continue;
    if (STRONG_CODE_PATTERNS.some((pattern) => pattern.test(linha))) {
      return true;
    }
  }

  return INLINE_CODE_PATTERNS.some((pattern) => pattern.test(texto));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function contemTermo(texto: string, termo: string): boolean {
  const alvo = normalizar(texto);
  const busca = normalizar(termo);

  if (busca.length === 0) return false;

  if (busca.includes(" ")) {
    return alvo.includes(busca);
  }

  const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(busca)}`);
  return pattern.test(alvo);
}

export function contarTermos(texto: string, termos: string[]): number {
  const unicos = [...new Set(termos.map(normalizar))];
  return unicos.filter(
    (termo) => termo.length > 0 && contemTermo(texto, termo),
  ).length;
}

export function tocaLacuna(
  texto: string,
  lacuna: { termos: string[] },
): boolean {
  return contarTermos(texto, lacuna.termos) > 0;
}
