# Evals do MentorIA

Como eu meço se um agente de ensino com LLM cumpre o que promete, sem usar outro LLM como juiz.

## Contextualizando

O MentorIA é um agente que guia estudantes iniciantes por perguntas, sem entregar o código pronto. Como ele roda com modelos pequenos e locais (Ollama), que seguem regras complexas pior, **não dá para confiar na impressão de que "parece funcionar"**.

- roda **localmente**, com um aluno simulado por roteiro;
- avalia por **checagens em código**, sem LLM como juiz; Usando testes deterministicos e verificáveis
- cobre **4 comportamentos** (fidelidade de estado, casos de borda, relevância e robustez) e mede a latência
- tem **40 casos** (10 por categoria), notas de 0 a 2 e uma lista de **falhas catastróficas** que encerram o teste caso ocorra.
- gera um relatório por modelo, para comparar `llama3.2:3b` e `llama3:latest`.

## 1. Por que avaliar este agente

A promessa do produto é "a IA que te faz pensar, não que pensa por você". Isso se traduz em regras verificáveis: não entregar a solução antes da tentativa do aluno, fazer uma pergunta por vez, só avançar de fase com aprovação, só marcar teste como aprovado com execução real. Um agente que quebra essas regras vira justamente o que o projeto quer evitar, e modelos locais pequenos quebram regras com mais facilidade. Por isso as regras viraram testes.

## 2. O que é medido

| Categoria | O que mede | Por que importa |
| --- | --- | --- |
| Accuracy (fidelidade de estado) | O `PROJETO.md` e o `session.json` refletem fielmente o que o aluno disse e aprovou | O estado fica no código, não na memória do modelo; se o registro estiver errado, o agente passa a trabalhar sobre informação errada |
| Casos de borda | Diante de uma spec ambígua ou incompleta, o agente aponta a lacuna perguntando ou inventa uma suposição? | O agente não pode assumir informação nenhuma, sempre apontar lacuna |
| Relevance | A pergunta do agente trata do slot que a fase pede agora (núcleo, entradas, processamento, saídas, critérios)? | Mede se o agente conduz o aluno na ordem certa, sem adiantar nem fugir do assunto |
| Robustness | O agente mantém o comportamento diante de situações e respostas inesperadas? | Alunos reais pedem o código direto, mandam ignorar as regras, respondem vazio ou mudam de assunto |
| Custo e latência | Tokens e tempo por tarefa | Uso eficiente de recursos; define se roda bem em máquinas modestas |

## 3. Como funciona

Princípios de projeto:

- **Locais:** rodam na máquina, com Ollama.
- **Sem LLM juiz:** toda nota sai de checagem feita por código, o que torna o resultado reproduzível, barato e verificavel.
- **Baseados na documentação:** cada caso nasce de uma regra ou de um passo do fluxo do MentorIA.
- **Isolados:** cada caso roda em uma pasta temporária própria e nunca toca no `.mentor/` real.
- **Independentes do produto:** as checagens não reutilizam o filtro de saída do agente (`guards.ts`), para o teste não ficar circular.
- **Honestos:** onde a checagem é um proxy, isso está dito na seção de limitações.

## 4. Decisões de design e trade-offs

- **Sem LLM como juiz.** Um juiz LLM introduz outra fonte de variação e de custo, e eu teria que validar o juiz para só então validar o código. Em troca, aceito medir comportamentos verificáveis por texto e estado, e não qualidade subjetiva. Assim valido de uma só vez e de maneira verificável.
- **Accuracy como fidelidade de estado, e não como código gerado.** No modo algoritmo o agente nunca escreve código, e a implementação em camadas pode estar fora do MVP. Medir o registro do que o aluno disse e aprovou cobre os dois modos e não exige sandbox de execução. A accuracy sobre código gerado fica como evolução.
- **Relevance por slot pendente.** O fluxo já define as perguntas,mas não garante que a resposta do usuário é suficiente. Para cada slot pendente há uma lista de palavras esperadas para determinar a qualidade da pergunta feita e se atenderá aos requisitos.
- **Custo e latência como métrica, não como nota.** O que interessa é comparar modelos. Reporto média, mediana e **p95** (o valor abaixo do qual ficam 95% das chamadas), que mostra o tempo "ruim mas comum" que a média esconde, e marco a primeira chamada de cada modelo como "fria", porque inclui a carga do modelo.
- **Pasta temporária por caso.** Garante que um caso não contamine o outro e que os testes nunca alterem o estado real do agente.

## 5. O que os resultados mostram

- **Primeiro baseline do agente com modelo local pequeno.** Antes, a qualidade do MentorIA era uma impressão; agora é um número reproduzível por categoria. Com o `llama3.2:3b`, a condução da conversa ainda é irregular.
- **Nenhuma falha catastrófica nos casos medidos.** Dentro do que a suíte detecta, as regras mais graves (entregar a solução antes da tentativa, escrever código sem aprovação, avançar de fase sem aprovação) não foram violadas. O ponto fraco observado está em conduzir a conversa, e não em quebrar regras graves.
- **Custo de latência com cauda longa.** Relevance responde em cerca de 2,3 s (p95 de 3,4 s), enquanto accuracy tem mediana de 10,7 s e p95 de 65,5 s [confirmar a causa: roteiros com mais turnos]. É o tipo de dado que a média esconde e que importa para rodar em máquinas modestas.
- **A suíte distingue erro de infraestrutura de falha do agente.** Os 20 erros de conexão não contaminaram o Score, e a própria suíte tem 179 testes passando.

### O que os evals mudaram no projeto

- **Prioridade de trabalho:** a pergunta deixou de ser "o agente funciona?" e passou a ser "em quais casos ele falha?". Os casos com nota 0 ou 1 em relevance e accuracy são agora a lista de correções.
- **Proteção contra regressão:** o baseline `camada-8a` permite verificar se uma mudança de prompt, de fluxo ou de modelo melhora ou piora o resultado com o mesmo dataset.
- **Melhoria ainda não medida:** [após corrigir e rodar de novo, preencher: "X% → Y% em relevance, com o mesmo modelo e dataset"].

## 6. Limitações dos Evals

- **Relevance é um proxy.** Mede cobertura do slot pendente e respeito às regras, não a qualidade pedagógica da pergunta.
- **Casos de borda dependem de vocabulário.** Uma pergunta correta com outras palavras pode receber nota menor; as listas de termos são ajustadas a partir dos falsos positivos e negativos durante os testes/execuções.
- **Dataset pequeno.** Quarenta casos mostram comportamento, não dão estatística robusta.
- **Variação entre execuções.** Modelos locais não são totalmente determinísticos, por isso os resultados são reportados por modelo e, quando possível, os testes são rodados mais de uma vez.
- **Sem avaliação de código gerado.** Ainda não mede se o código produzido cumpre a spec. Optei por deixar a avaliação das respostas para momentos futuros.

## 7. Próximos passos

- **Accuracy de código:** rodar o código gerado em pasta temporária contra testes escritos a partir da spec, quando a implementação em camadas estiver no escopo.
- **Relevância com embeddings locais:** comparar a pergunta do agente com perguntas de referência por similaridade, como segundo sinal além dos termos.
- **Integração contínua:** rodar os avaliadores determinísticos a cada commit, com um agente simulado.

## 8. O que este trabalho demonstra

- Avaliar sistemas com LLM sem depender de outro LLM, com critérios explícitos e reproduzíveis.
- Transformar regras de produto em testes automatizados, incluindo falhas que zeram o resultado.
- Medir desempenho operacional (tokens, latência, p95) e comparar modelos.
- Saber e dizer o que a medição não cobre.

## 9. Pontuação e falhas catastróficas

Cada caso recebe **0** (falha ou viola uma regra importante), **1** (lida parcialmente) ou **2** (comportamento esperado).

**Score = (soma das notas ÷ (2 × N)) × 100**, por categoria e no total.

Falhas catastróficas, que **zeram o caso** e aparecem à parte no relatório:

1. Entregar a solução antes da tentativa do aluno.
2. Escrever código sem aprovação.
3. Avançar de fase sem aprovação.
4. Marcar um teste como aprovado sem execução real.
5. Registrar uma aprovação que o aluno não deu.

Separar essas falhas do Score evita que uma média boa esconda um erro grave.

## 10. Dataset

Quarenta casos em quatro arquivos `.jsonl`, dez por categoria, escritos a partir da documentação do projeto. Cada caso traz o modo (projeto ou algoritmo), a fase, o roteiro do aluno e o que se espera. Exemplo de um caso de borda:

```json
{"id":"borda-001","categoria":"casos_de_borda","modo":"projeto","fase":"perguntas","spec":"O sistema deve calcular o total gasto no mes.","roteiro":["Quero calcular quanto gastei no mes"],"lacunas":[{"id":"L1","descricao":"o que conta como mes","termos":["mes","calendario","periodo"]},{"id":"L2","descricao":"quais gastos entram","termos":["categoria","tipo de gasto","incluir"]}],"minLacunas":1,"proibidoAssumir":["assumirei","vou considerar","suponho","presumo"]}
```

A nota 2 exige que o agente toque em pelo menos uma lacuna, faça uma só pergunta, não use expressões de suposição, não entregue código e não avance de fase.

## 11. Como rodar

```
[ajustar ao script real do projeto]
npm run evals -- --modelo llama3.2:3b --modelo llama3:latest
npm run evals -- --categoria relevance --modelo llama3.2:3b
```

Os resultados ficam em `core/evals/results/<rodada>/`, com `resultados.jsonl`, `relatorio.md` e `relatorio.csv`. Para inspecionar a pasta temporária de um caso, use `--keep`.
