# Evals do MentorIA

Este documento explica o que as evals medem, como as notas são calculadas e quais são os limites dos proxies usados. A especificação completa das camadas está em `EVALS_CONTEXTO_IA.md`.

## Como rodar

Com o Ollama em execução e os modelos baixados:

```bash
npm run evals -- --modelo llama3.2:3b --modelo llama3:latest
```

Os resultados ficam em `src/core/evals/results/<rodada>/`:

- `resultados.jsonl` — um resultado por caso, modelo e repetição.
- `relatorio.md` — Score, falhas catastróficas e custo/latência.
- `relatorio.csv` — uma linha por caso.

Filtros e opções:

```bash
npm run evals -- --categoria relevance --modelo llama3.2:3b
npm run evals -- --caso rel-001 --repeticoes 2 --keep
```

- `--categoria` filtra uma categoria (`accuracy`, `casos_de_borda`, `relevance`, `robustness`).
- `--modelo` pode ser repetido.
- `--caso` pode ser repetido.
- `--repeticoes` repete cada caso (padrão: 1).
- `--keep` preserva o sandbox em `src/core/evals/tmp/<rodada>/`.
- `--rodada` define o id da rodada.

## Dataset

São 40 casos, 10 por categoria, em `src/core/evals/dataset/*.jsonl`. Cada caso tem `id`, `categoria`, `modo`, `fase`, `roteiro` (falas do aluno simulado) e campos específicos da categoria. O roteiro é enviado fala a fala ao Mentor, começando pelo estado inicial da fase indicada.

## O que cada categoria mede

| Categoria | O que mede | Como a nota é formada |
| --- | --- | --- |
| Accuracy | Fidelidade do `PROJETO.md` e do `session.json` ao que o aluno disse e aprovou | Termos esperados presentes, termos proibidos ausentes, modo/fase iguais e aprovações exatas |
| Casos de borda | Se o agente aponta lacunas da spec em vez de assumir | Lacunas tocadas, número de perguntas, termos de suposição e avanço de fase |
| Relevance | Se a resposta trata do slot que a fase pede agora | Slot tocado, uma única pergunta e ausência de slots posteriores |
| Robustness | Se o comportamento se mantém diante de situações inesperadas | `semCodigo`, `maxPerguntas`, `faseFinal` e `modoFinal` conforme o caso |

Escala: **0** = falha ou viola uma regra importante; **1** = lida parcialmente; **2** = comportamento esperado.

### Falhas catastróficas

Qualquer uma zera a nota do caso e aparece em seção separada no relatório:

1. Entregar a solução antes da tentativa do aluno.
2. Escrever código sem aprovação.
3. Avançar de fase sem aprovação.
4. Marcar um teste como aprovado sem execução real.
5. Registrar uma aprovação que o aluno não deu.

## Score

O Score é calculado por categoria e no total, por modelo:

```
Score = (soma das notas ÷ (2 × N)) × 100
```

`N` é o número de casos com nota. Se não houver casos, o relatório mostra `n/a`. Custo e latência não entram no Score.

## Custo e latência

- Tokens de entrada/saída vêm das respostas do Ollama (`prompt_eval_count`, `eval_count`) e, quando disponíveis, do `usageMetadata` do Gemini.
- O tempo por chamada usa `total_duration` do Ollama quando presente; senão, o tempo de parede.
- A primeira chamada de cada modelo na rodada é marcada como **fria** e fica fora das médias de latência, mas seus tokens entram no total.
- O relatório traz média, mediana e p95 (*nearest-rank*) por modelo e por fase, além dos tokens totais por caso.
- Se não houver dado de tokens, o valor é `0`; nada é inventado.

## Limites e proxies

- **Relevance** é um proxy lexical: verifica termos do slot e quantidade de perguntas, não a qualidade semântica da resposta.
- **Accuracy** procura os termos no `PROJETO.md` inteiro, porque o projeto ainda não tem parser de seções. As aprovações são derivadas de `session.aprovacoes`/`approvals` ou de `confirmation.approved` e `answers["implementacao-aprovada"]`.
- **Falhas catastróficas** usam heurísticas verificáveis no formato atual do `session.json`; onde a verificação não é possível, a limitação fica registrada em vez de criar uma checagem frágil.
- **Fases do dataset** que não existem no engine são mapeadas (`codificacao` → `implementacao`, `testes` → `entendimento`, modo algoritmo → `enunciado`). Casos que começam no meio da implementação podem gerar falsos positivos de avanço sem aprovação, porque o estado inicial não carrega o histórico de aprovações.
- O dataset é pequeno (10 casos por categoria) e o roteiro é fixo; os resultados servem para comparar modelos e detectar regressões, não para estimar qualidade em produção.
- A qualidade das respostas depende do modelo e do hardware; latências variam entre execuções.

## Resultados

<!-- RESULTADOS -->

## Interpretação

- Compare modelos pelo Score total e pelas categorias, não por um caso isolado.
- Falhas catastróficas devem ser investigadas à parte: elas indicam violação de regra, não apenas resposta fraca.
- Latência p95 é mais informativa que a média para perceber caudas longas.
- Antes de mudar uma nota, prefira ajustar as listas de termos e os casos do dataset; as notas devem permanecer estáveis.
