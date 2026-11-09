import { describe, expect, it } from "vitest";
import {
  checkDesignOutput,
  checkQuestionOutput,
  containsCode,
  containsReadySolution,
} from "../src/core/guards.js";

describe("containsCode", () => {
  it("detecta bloco de código cercado", () => {
    expect(containsCode("Veja:\n```ts\nconst x = 1;\n```")).toBe(true);
  });

  it("detecta declaração de função", () => {
    expect(containsCode("function soma(a, b) {")).toBe(true);
  });

  it("detecta atribuição em linha de código", () => {
    expect(containsCode("const total = 0;")).toBe(true);
  });

  it("não confunde explicação em português com código", () => {
    const texto =
      'Percorra de trás para frente e use split(" ") só como comparação.';

    expect(containsCode(texto)).toBe(false);
  });

  it("permite citar palavras-chave dentro de uma explicação", () => {
    const textos = [
      "Você vai precisar usar import para trazer a biblioteca.",
      "O import (em Python) carrega um módulo.",
      "import é uma palavra-chave do Python.",
      "return (valor) devolve o resultado da função.",
      "if (condição) então faça algo.",
      "const é usado para valores que não mudam.",
      "class (classe) modela um objeto.",
      "o operador => cria uma função.",
    ];

    for (const texto of textos) {
      expect(containsCode(texto)).toBe(false);
    }
  });

  it("continua detectando código que usa essas palavras-chave", () => {
    const codigos = [
      "import os",
      "import { useState } from 'react';",
      "from math import sqrt",
      "export default function App() {",
      "def soma(a, b):",
      "class Foo extends Bar {",
      "const total = 0;",
      "if (x) {",
      "return a + b;",
    ];

    for (const codigo of codigos) {
      expect(containsCode(codigo)).toBe(true);
    }
  });
});

describe("containsReadySolution", () => {
  it("detecta entrega explícita de solução", () => {
    expect(containsReadySolution("Aqui está a solução completa.")).toBe(true);
  });

  it("detecta código como solução pronta", () => {
    expect(containsReadySolution("```js\nreturn 1;\n```")).toBe(true);
  });

  it("não marca uma pergunta comum", () => {
    expect(containsReadySolution("Como você imagina que isso vai funcionar?")).toBe(
      false,
    );
  });
});

describe("checkQuestionOutput", () => {
  it("aceita uma pergunta sem código", () => {
    expect(checkQuestionOutput("Qual é o seu nível de experiência?")).toEqual({
      ok: true,
    });
  });

  it("rejeita pergunta com código", () => {
    const result = checkQuestionOutput("```js\nconst a = 1;\n```");

    expect(result.ok).toBe(false);
  });

  it("rejeita solução pronta", () => {
    const result = checkQuestionOutput("Segue o código completo da resposta.");

    expect(result.ok).toBe(false);
  });
});

describe("checkDesignOutput", () => {
  it("aceita desenho lógico em passos", () => {
    const result = checkDesignOutput(
      "1. Entenda o problema.\n2. Percorra de trás para frente.\n3. Conte os caracteres.",
    );

    expect(result).toEqual({ ok: true });
  });

  it("rejeita desenho com código", () => {
    const result = checkDesignOutput("```js\nfunction f() {}\n```");

    expect(result.ok).toBe(false);
  });
});
