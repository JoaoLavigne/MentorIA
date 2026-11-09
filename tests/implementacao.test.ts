import { describe, expect, it } from "vitest";
import { parseLayerPlan } from "../src/core/phases/implementacao.js";

describe("parseLayerPlan", () => {
  it("lê camadas no formato nome + resumo", () => {
    const layers = parseLayerPlan(
      [
        "Camada: Núcleo",
        "Resumo: salvar e listar os registros",
        "",
        "Camada: Interface",
        "Resumo: tela única com campo e lista",
      ].join("\n"),
    );

    expect(layers).toEqual([
      { name: "Núcleo", summary: "salvar e listar os registros" },
      { name: "Interface", summary: "tela única com campo e lista" },
    ]);
  });

  it("usa o nome como resumo quando o resumo não vem", () => {
    const layers = parseLayerPlan("Camada: Núcleo");

    expect(layers).toEqual([{ name: "Núcleo", summary: "Núcleo" }]);
  });

  it("ignora texto sem o formato de camada", () => {
    expect(parseLayerPlan("Vou implementar tudo de uma vez.")).toEqual([]);
  });
});
