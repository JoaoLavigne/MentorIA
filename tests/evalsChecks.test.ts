import { describe, expect, it } from "vitest";
import {
  contemTermo,
  contarPerguntas,
  contarTermos,
  normalizar,
  temCodigo,
  tocaLacuna,
} from "../src/core/evals/evaluators/shared/checks.js";

describe("normalizar", () => {
  it("remove acentos, baixa caixa e compacta espaços", () => {
    expect(normalizar("  Programação   RÁPIDA ")).toBe("programacao rapida");
    expect(normalizar("AÇÃO")).toBe("acao");
  });
});

describe("contarPerguntas", () => {
  it("conta grupos de interrogação como uma pergunta", () => {
    expect(contarPerguntas("Tudo bem?")).toBe(1);
    expect(contarPerguntas("Sério??")).toBe(1);
  });

  it("conta perguntas separadas", () => {
    expect(contarPerguntas("Um? Dois? Três?")).toBe(3);
  });

  it("retorna zero sem pergunta", () => {
    expect(contarPerguntas("Faça isso.")).toBe(0);
    expect(contarPerguntas("")).toBe(0);
  });
});

describe("temCodigo", () => {
  it("não confunde texto comum com código", () => {
    expect(temCodigo("Percorra o array e conte os elementos.")).toBe(false);
    expect(temCodigo("return (valor) devolve o resultado.")).toBe(false);
    expect(
      temCodigo("Você vai precisar usar import para trazer a biblioteca."),
    ).toBe(false);
  });

  it("detecta bloco cercado", () => {
    expect(temCodigo("```js\nconst x = 1;\n```")).toBe(true);
  });

  it("detecta código sem crases", () => {
    expect(temCodigo("const total = 0;")).toBe(true);
    expect(temCodigo("function soma(a, b) {")).toBe(true);
    expect(temCodigo("SELECT nome FROM alunos")).toBe(true);
  });

  it("detecta código inline conhecido", () => {
    expect(temCodigo("Use console.log('oi') para depurar.")).toBe(true);
  });
});

describe("contemTermo", () => {
  it("casa no início da palavra ignorando acentos e caixa", () => {
    expect(contemTermo("O VALOR total", "valor")).toBe(true);
    expect(contemTermo("AÇÚCAR", "acucar")).toBe(true);
  });

  it("não casa no meio da palavra", () => {
    expect(contemTermo("desvalorizar", "valor")).toBe(false);
  });

  it("casa termos com espaço por includes", () => {
    expect(contemTermo("Em TEMPO REAL", "tempo real")).toBe(true);
    expect(contemTermo("tempo", "tempo real")).toBe(false);
  });
});

describe("contarTermos", () => {
  it("conta quantos termos da lista aparecem", () => {
    expect(
      contarTermos("valor e categoria, sem processamento", [
        "valor",
        "categoria",
        "saida",
      ]),
    ).toBe(2);
  });

  it("retorna zero quando nenhum termo aparece", () => {
    expect(contarTermos("nada relevante", ["valor", "categoria"])).toBe(0);
  });
});

describe("tocaLacuna", () => {
  it("retorna true quando algum termo da lacuna aparece", () => {
    expect(tocaLacuna("qual o valor do desconto?", { termos: ["valor", "taxa"] })).toBe(
      true,
    );
  });

  it("retorna false quando nenhum termo aparece", () => {
    expect(tocaLacuna("não sei ainda", { termos: ["valor", "taxa"] })).toBe(false);
  });
});
