import { describe, expect, it } from "vitest";
import { checkAlgorithmOutput } from "../src/core/guards.js";

describe("checkAlgorithmOutput", () => {
  it("aceita palavras isoladas que antes eram rejeitadas", () => {
    for (const word of ["const", "let", "import", "int", "double", "return"]) {
      expect(checkAlgorithmOutput(word)).toEqual({ ok: true });
    }
  });

  it("aceita uma frase comum", () => {
    expect(
      checkAlgorithmOutput("Percorra o array de trás para frente e conte os elementos."),
    ).toEqual({ ok: true });
  });

  it("aceita uma única linha de código (menos de 2 pontos)", () => {
    expect(checkAlgorithmOutput("const total = 0;")).toEqual({ ok: true });
  });

  it("aceita uma linha forte somada a uma fraca (1,5 ponto)", () => {
    const result = checkAlgorithmOutput("return total;\nconsole.log(total)");

    expect(result).toEqual({ ok: true });
  });

  it("reprova duas linhas de código fortes", () => {
    const result = checkAlgorithmOutput("const total = 0;\nreturn total;");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("sua resposta contém código");
      expect(result.reason).toContain("reescreva só com explicação em texto");
      expect(result.reason).toContain("gravidade 2");
      expect(result.reason).toContain("const total = 0;");
      expect(result.reason).toContain("return total;");
    }
  });

  it("soma linhas fracas para atingir o limite", () => {
    const result = checkAlgorithmOutput(
      "const total = 0;\nSELECT nome FROM alunos\nnpm install express",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("gravidade 2");
      expect(result.reason).toContain("SELECT nome FROM alunos");
      expect(result.reason).toContain("npm install express");
    }
  });

  it("reprova bloco cercado por ``` mesmo com uma única linha", () => {
    const result = checkAlgorithmOutput("```js\nconst total = 0;\n```");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Bloco cercado");
      expect(result.reason).toContain("const total = 0;");
    }
  });

  it("detecta linhas de código dentro de itens de lista", () => {
    const result = checkAlgorithmOutput(
      "- const total = 0;\n- console.log(total)\n- print(total)",
    );

    expect(result.ok).toBe(false);
  });
});
