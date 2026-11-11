# Mentor — Agente de desenvolvimento assistido

*Documento do projeto · Hackath~~on Build Your First AI App 2026 (Yasir Insig~~hts) · nome provisório*

> **"A IA que te faz pensar, não que pensa por você."**

## 1. Visão geral

**Categoria no hackathon:** Assistentes de estudo de IA.

**Problema:** estudantes iniciantes usam IA para receber o código pronto e acabam terceirizando o entendimento do próprio projeto. Entregam algo que funciona, mas não sabem explicar por quê.

**Proposta:** um agente que atua como um engenheiro de software experiente ao lado do aluno. O aluno cola o enunciado (ou descreve a ideia) e o agente conduz o desenvolvimento por perguntas: objetivo, entradas, saídas, arquitetura, casos de borda, critérios de aceitação. No início, o aluno escolhe entre **criar um projeto do zero** ou **resolver um problema de estrutura de dados/algoritmos**, e o agente adapta o fluxo ao modo escolhido. **O aluno decide e projeta; a IA questiona, implementa em camadas aprovadas e depois verifica se o aluno entendeu o que foi feito.**

**Diferencial:**

- O aluno sai com um documento vivo (`PROJETO.md`) escrito a partir das próprias respostas e decisões.
- Roda localmente com **Ollama**, sem chave de API e sem custo, pensado para estudantes que não podem pagar uma LLM.
- A IA nunca entrega a resposta de uma etapa antes de o aluno tentar.

## 2. Regras inegociáveis do agente

1. **A IA não entrega a resposta.** Pode ter uma solução própria como referência interna, mas só a revela depois de o aluno desenhar a lógica.
2. **O aluno decide, a IA executa.** Decisões de arquitetura, escopo e ferramentas são do aluno. A IA escreve o código apenas depois de o aluno aprovar a teoria (o que será implementado e por quê).
3. **Aprovação explícita antes de cada camada.** Nada é escrito ou alterado sem aprovção do aluno.
4. **Nunca forçar a aprovação de testes.** Um critério só é marcado como aprovado com o resultado real de uma execução. Quando não for possível escrever ou rodar o teste, a IA comunica o aluno e registra "não verificado".
5. **Documento vivo.** O `PROJETO.md` é atualizado ao vivo, a cada resposta e decisão.
6. **Uma pergunta por vez**, aberta e sem opções prontas, calibrada pelo nível do aluno.
7. **Honestidade sobre limites.** A IA diz o que não consegue verificar e pede ao aluno que faça e reporte.

## 3. Fluxo de conversa

Cada fase tem um objetivo, perguntas, o que é registrado no `PROJETO.md` e uma condição para avançar. A fase só avança com a aprovação do aluno registrada.

### 3.1 Conhecendo o DEV

- Nível de experiência.
- Ferramentas que já usou.
- Preferência de linguagem.
- Registrado como perfil do aluno, usado para ajustar vocabulário e profundidade das perguntas.

### 3.2 Escolha do modo

- A IA pergunta, uma pergunta por vez: "Você quer criar um projeto do zero ou resolver um problema de estrutura de dados/algoritmos?"
- Registrado no `PROJETO.md` como **modo de trabalho** (`projeto` ou `algoritmo`).
- A fase só avança quando o modo está definido.

#### 3.2.1 Caminho A — Criar projeto

Segue o fluxo das seções 3.3 a 3.8: ideia, perguntas, esboço, confirmação, implementação em camadas e entendimento. Revisão, segurança e demais itens ficam no pós-MVP (3.9).

#### 3.2.2 Caminho B — Resolver problema de estrutura de dados/algoritmos

O agente colhe o enunciado e desenha a implementação para resolver o problema, apenas logicamente e sem código, em formato de passos. O aluno acompanha o raciocínio e aponta discordâncias antes da implementação.

Formato da resposta:

1. **Entender o problema:** o que deve ser retornado e quais armadilhas o enunciado esconde.
2. **Tentar a ideia óbvia e quebrá-la:** a solução mais direta e o caso concreto em que ela falha.
3. **A ideia central:** a estratégia que cobre os casos quebrados, em linguagem natural.
4. **O que programar, em ordem:** os passos lógicos da implementação, sem código — índices, laços, condições e a ordem das checagens.
5. **Bordas:** sem espaços no fim, uma só palavra, espaços no começo ou no fim, entradas vazias e limites.

Depois do desenho, o aluno implementa e explica a solução; a IA revisa o raciocínio e a complexidade, nunca entregando o código pronto.

Exemplo (enunciado: retornar o tamanho da última palavra de uma string):

- **Entender:** o retorno é o tamanho da última palavra; espaços no fim são a armadilha.
- **Ideia óbvia quebrada:** olhar o último caractere falha em `"moon "`; `split(" ")` cria pedaços vazios com espaços repetidos ou finais.
- **Ideia central:** percorrer de trás para frente em duas fases — pular espaços finais e contar até o próximo espaço.
- **Programar em ordem:** posicionar o índice no fim; laço 1 recua sobre espaços; zerar o contador; laço 2 conta e recua até espaço ou início; retornar o contador. A checagem de índice válido vem antes do caractere.
- **Bordas:** `"Hello World"` não executa o laço 1; `"a"` termina ao chegar ao início; `" a"` para no limite; `"a "` é resolvido pelo laço 1.

### 3.3 Ideia (modo projeto)

- O que o aluno quer.
- Como vai ser feito.
- O que **não** quer.
- Como medir que o resultado foi alcançado.

### 3.4 Perguntas (a IA devolve feedback)

- Qual o núcleo do projeto.
- Quais as entradas.
- Como será processado.
- Quais as saídas.
- Quais os critérios de aceitação.
- O que pensou sobre: interfaces, dependências, persistência de dados, limites entre os módulos e arquitetura.

### 3.5 Esboço (feito pelo aluno · modo projeto)

- Esboço do projeto: integração, validação e comunicação entre dependências.
- "Quais informações você acha relevantes e ainda não disse?"
- Casos de borda: o que acontece se X ou Y falhar?
- Escolha de ferramenta: tem preferencia por alguma ferramenta especifica?

### 3.6 Confirmação (o aluno decide)

- A IA devolve o que será implementado.
- O aluno tem a oportunidade de refazer alguma fase ou responder novamente alguma pergunta.
- O aluno aprova a teoria antes de qualquer código ser escrito.
- O aluno deve aprovar a sugestão de camadas de implementação da IA.

### 3.7 Implementação (em camadas, mediante aprovação)

- A IA escreve o código, uma camada por vez, de dentro para fora (o aluno escolhe qual é a parte principal).
- Cada camada lê: o que foi implementado no ultimo **passo**, as **regras** e **o que vai ser implementado**.
- Para o código não virar caixa-preta: antes de cada camada, o aluno diz o que espera que ela faça e onde pode falhar.

### 3.8 Entendimento (ligado por padrão, com opção de pular)

- Perguntas sobre o que foi implementado.
- O formato exato (perguntas soltas ou o aluno explicando o mapa do próprio app) ainda está em aberto (ver seção 9).

### 3.9 Pós-MVP

- **Revisão (testes e critérios de aceitação):**
  - Onde está o problema?
  - Em qual cenário está ocorrendo?
  - Qual a consequência?
  - Correção feita pelo aluno, avaliada com base na correção de referência da IA para saber se resolveu.
  - Nunca forçar a aprovação de testes (regra 4).
- **Segurança:**
  - A IA pergunta: "O que você pensou ser o mínimo necessário?"
  - Verificação de chaves e informações sensíveis expostas.
- **Caça à falha:** a IA diz "encontrei uma falha de segurança, de teste ou de lógica em tal lugar"; o aluno a identifica e pensa na solução.
- **Extensão nativa do VS Code.**

## 4. Documento vivo: `PROJETO.md`

Criado na raiz do projeto do aluno e atualizado a cada fase. Conteúdo:

- Perfil do aluno (nível, ferramentas, linguagem).
- Modo de trabalho: `projeto` ou `algoritmo`, com a justificativa do aluno.
- Ideia: o que quer, o que não quer, como medir o sucesso.
- Respostas às perguntas (núcleo, entradas, processamento, saídas, critérios de aceitação).
- Arquitetura: responsabilidades, interfaces, dependências, persistência, limites entre módulos.
- No modo algoritmo: enunciado, desenho lógico da solução em passos (sem código), bordas e complexidade de tempo e espaço.
- Decisões com alternativas: o que foi escolhido, o que foi descartado e por quê.
- Casos de borda levantados.
- Camadas implementadas e aprovações.
- Resultado dos testes (aprovado, reprovado ou não verificado).
- Resultado do modo Entendimento (ou "pulado").
- Respostas de segurança.
- Fechamento: o que aprendi e o que faria diferente.

O texto do documento deve refletir as respostas do aluno, não ser redigido pela IA no lugar dele.

## 5. Arquitetura técnica

### 5.1 Decisões

| Decisão | Escolha | Motivo |
| --- | --- | --- |
| Tipo de solução | Agente guiado por fluxo (orquestrador + modelo) | Fases com estado, previsibilidade e prazo curto |
| Modelo | **Ollama**, local | Gratuito para estudantes, sem chave de API |
| Primeira entrega | **CLI** executada na pasta do projeto do aluno | Lê código, `PROJETO.md` e arquitetura; mais simples que a extensão |
| Entrega futura | Extensão do VS Code | Mais integrada; reaproveita o núcleo |
| Linguagem | TypeScript | O núcleo é reaproveitado pela extensão sem duplicar linguagem; o Ollama tem biblioteca JS |
| Distribuição | Repositório no GitHub | Clonar, instalar dependências e rodar |

### 5.2 Estrutura do repositório

```
mentor/
├── README.md              # instalação: Ollama, modelo, como rodar
├── package.json
├── src/
│   ├── core/              # sem interface; reaproveitado pela extensão
│   │   ├── phases/        # uma definição por fase (prompt curto + critério de conclusão)
│   │   ├── session.ts     # estado: fase atual, respostas, decisões
│   │   ├── engine.ts      # laço: monta contexto → chama modelo → valida → atualiza estado
│   │   ├── llm.ts         # interface LLM + adaptador Ollama (outros provedores no futuro)
│   │   ├── guards.ts      # filtros de saída (bloqueia código/resposta pronta)
│   │   ├── agentDoc.ts    # lê e escreve o PROJETO.md
│   │   └── workspace.ts   # lê arquivos do projeto do aluno
│   └── cli/
│       └── index.ts       # entrada e leitura do terminal
├── tests/                 # testes do guards e do engine
└── docs/                  # prompts de teste, modelos testados
```

No projeto do aluno, a CLI cria:

- `PROJETO.md` na raiz: o documento vivo.
- `.mentor/session.json`: estado da sessão, para retomar depois de fechar o terminal.

### 5.3 Regras de organização

- `core` nunca importa nada de `cli`. A extensão futura só chama o `engine`.
- `llm.ts` define a interface `LLM` e o adaptador `OllamaLLM`; o `engine` depende da interface, não do provedor. Outros provedores poderão ser adicionados no futuro sem alterar o núcleo.
- Fases são dados, não `if`s espalhados: cada uma declara prompt, o que precisa ser respondido para avançar e o que vai para o `PROJETO.md`.
- `guards.ts` tem testes desde o início, porque sustenta a promessa de "não entregar a resposta".

## 6. Como o agente funciona

O modelo pequeno é um componente; o controle fica no código.

- **O estado fica no código, não na memória do modelo.** O programa controla a fase atual e o `PROJETO.md`; o modelo só gera a próxima pergunta ou o feedback.
- **Ao abrir a CLI, o progresso é lido dos arquivos**, não da conversa, e a IA diz em uma frase onde o aluno parou.
- **O modo fica no estado**, não na conversa: `projeto` ou `algoritmo` é salvo na sessão e decide quais fases e perguntas são carregadas.
- **Portões entre fases:** se faltar algo aprovado, o programa nomeia a lacuna e não avança (verificação em código).
- **Um prompt curto por fase**, em vez de um prompt gigante com todas as regras.
- **Filtro de saída:** na fase de perguntas, uma resposta com bloco de código ou solução pronta é rejeitada e regenerada.
- **Uma pergunta por vez.**
- **Contexto da implementação:** cada camada recebe um *resumo* da camada anterior (guardado no estado), os passos, as regras e o que será implementado, em vez do código inteiro.
- **Resultados de teste vêm de execução real**, nunca da palavra do modelo.
- **Verificação de segredos com código determinístico:** padrões de chaves, arquivos `.env`, `.gitignore`. O modelo só comenta o resultado e faz a pergunta do "mínimo necessário". `.mentor/` entra no `.gitignore`.

## 7. Distribuição e instalação

1. O usuário instala o **Ollama** e baixa um modelo.
2. Clona o repositório do GitHub e instala as dependências.
3. Roda a CLI dentro da pasta do projeto; ela conversa com o Ollama em `localhost:11434`.

O `README` traz esses passos e um **script de verificação** ("o Ollama está rodando? o modelo está baixado?"), já que a maioria dos problemas de iniciantes estará aí.

A extensão do VS Code (pós-MVP) acrescenta: painel de chat lateral, acesso à pasta aberta, criação do `PROJETO.md` no projeto e instalação por arquivo `.vsix`.

## 8. Ordem de construção e escopo

### 8.1 Ordem acordada

1. `llm.ts` + um "olá" funcionando com o Ollama.
2. `session.ts` + `agentDoc.ts`: salvar e retomar estado, gerar o `PROJETO.md`.
3. **Uma fase só** (Conhecendo o DEV + Escolha do modo + Ideia) de ponta a ponta, com `engine` e `guards`. Aqui se valida o maior risco: o modelo pequeno seguir as regras.
4. Demais fases, repetindo o padrão da primeira, incluindo o caminho B (algoritmos).
5. Modo Entendimento e fechamento.
6. Pós-MVP: `workspace.ts` e a fase de Revisão (ler o código do aluno), Segurança e caça à falha.

### 8.2 Sugestão de corte para o prazo *(ainda não confirmada)*

- **Entra primeiro:** Conhecendo o DEV → Escolha do modo → Ideia → Perguntas → Esboço → Confirmação, com o `PROJETO.md` vivo. Já é uma demo completa do conceito.
- **Atalho de demo:** o caminho B (algoritmo) pode entrar antes do caminho A, porque valida o mesmo núcleo com menos escopo e sem arquitetura de aplicação.
- **Depois, se der tempo:** Implementação em camadas e Entendimento.
- **Pós-MVP:** Revisão, Segurança, caça à falha e extensão do VS Code.

## 9. Pontos em aberto

- **Plano de testes antes de codar:** transformar os critérios de aceitação em testes concretos na Confirmação (hoje aparecem só na Revisão, no pós-MVP).
- **Escopo do MVP:** incluir a pergunta "o que fica fora desta versão?" no Esboço.
- **Mapa de aprendizado:** a ideia original (colar o enunciado e a IA dizer o que o aluno precisa aprender) não está no fluxo atual. É um gancho forte para a demo.
- **Segurança mais cedo:** além da pergunta final, perguntar o mínimo também no Esboço, junto com os casos de borda.
- **Formato do modo Entendimento:** perguntas soltas ou o aluno explicando o mapa do próprio app.
- **Nome do produto.**
- **Regulamento do hackathon:** confirmar exigências de vídeo de demonstração, repositório público e regras de uso de IA.

## 10. Riscos e observações

| Risco | Observação / mitigação |
| --- | --- |
| **Modelos locais pequenos (3B a 8B)** seguem regras complexas pior e podem entregar a resposta ou perder o fio | Estado no código, prompts curtos por fase, filtro de saída, uma pergunta por vez; testar em 2 ou 3 modelos e documentar o melhor |
| **Código fraco gerado por modelo pequeno** na Implementação | Testar cedo; considerar permitir um modelo maior ou voltado a código só nessa etapa |
| **"IA escreve o código" muda a promessa do produto** | Deixar claro no pitch: o aluno decide, projeta e explica; a IA digita. O modo Entendimento é o que prova que o aluno compreende |
| **Aluno que trava e desiste** | Decisão do projeto: sem escada de dicas, o fluxo fica como está. Risco aceito; validar em testes com pessoas reais |
| **Aprovar sem entender** | Pedir a expectativa antes de cada camada e a explicação do aluno depois |
| **Escopo grande para um hackathon** | Priorizar a primeira fase de ponta a ponta; o resto vem em camadas |
| **Vazar a solução** | Guards testados desde o início; referência interna só revelada após a tentativa do aluno |

**Teste com pessoas reais cedo:** 2 ou 3 pessoas já no começo, para ver se o aluno abandona por frustração e se a IA "vaza" a solução. Ajustar o prompt com esses testes vale mais que qualquer funcionalidade extra.

## 11. Pitch e demo

- **Tagline:** "A IA que te faz pensar, não que pensa por você."
- **Demonstração:** o aluno cola o enunciado do próprio hackathon e sai com um `PROJETO.md` feito a partir das respostas dele (meta-demo).
- **Em 30 segundos:** Não faz por você, guia o seu raciocinio para encontrar a solução. Juntos projetam, criam os requisitos de software, implementam a solução e por fim testam.
- **Argumento de acesso:** roda local com Ollama, de graça, para quem não pode pagar uma LLM.
