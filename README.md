# Mentor

A IA que te faz pensar, não que pensa por você.

## Requisitos

- Node.js 20 ou superior.
- [Ollama](https://ollama.com/) instalado e em execução.
- Um modelo baixado (o padrão é o `llama3.2:3b`).

## Instalação

```bash
git clone git@github.com:JoaoLavigne/MentorIA.git
cd MentorIA
npm install
npm run build
```

Se o Ollama ainda não estiver rodando ou o modelo não estiver baixado:

```bash
ollama serve
ollama pull llama3.2:3b
```

## Como usar

O Mentor grava os arquivos na **pasta atual**. Rode a CLI de dentro da pasta onde o projeto do aluno deve ficar, não na pasta do MentorIA:

```bash
mkdir -p ~/mentor-teste
cd ~/mentor-teste
node /caminho/para/MentorIA/dist/cli/index.js
```

Sem build, rodando direto do TypeScript:

```bash
cd ~/mentor-teste
/caminho/para/MentorIA/node_modules/.bin/tsx /caminho/para/MentorIA/src/cli/index.ts
```

Dica: crie um alias para usar de qualquer pasta.

```bash
alias mentor="node /caminho/para/MentorIA/dist/cli/index.js"
```

A conversa acontece no terminal e precisa ser interativa (entrada via pipe não funciona).

### VS Code

Funciona no terminal integrado do VS Code, já que ele é um TTY e a conversa interativa roda normalmente. Abra a pasta do projeto do aluno no VS Code (`File > Open Folder`) e use o terminal integrado (`Ctrl` + backtick). Como o `package.json` não declara um entry `bin`, inicie de dentro dessa pasta apontando para o build ou para o TypeScript:

```bash
cd ~/mentor-teste
node /caminho/para/MentorIA/dist/cli/index.js
# ou, sem build
/caminho/para/MentorIA/node_modules/.bin/tsx /caminho/para/MentorIA/src/cli/index.ts
```

Se preferir rodar o próprio repositório, `npm start` funciona, mas os arquivos gerados serão gravados na pasta do MentorIA — por isso o fluxo recomendado é abrir a pasta do aluno.

### Atalho de demo (pasta isolada)

```bash
npm run demo
```

O script compila o projeto se necessário e roda o agente em `mentor-run/`, na raiz do repositório, para não misturar os arquivos gerados com o código do Mentor. Para escolher outra pasta:

```bash
npm run demo -- ~/mentor-teste
```

### Configuração

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `MENTOR_MODEL` | `llama3.2:3b` | Modelo do Ollama usado na conversa. |
| `OLLAMA_URL` | `http://localhost:11434` | Endereço do servidor Ollama. |

Exemplo:

```bash
MENTOR_MODEL=llama3:latest mentor
```

## Modos de uso

Depois de conhecer o aluno, o Mentor pergunta o que ele quer fazer:

- **Criar um projeto:** fluxo completo de ideia, requisitos, arquitetura, confirmação, implementação em camadas e entendimento.
- **Resolver um problema de estrutura de dados/algoritmos:** o agente colhe o enunciado e desenha a solução apenas logicamente, em passos e sem código, antes de o aluno implementar.

O modo escolhido (`projeto` ou `algoritmo`) fica registrado no `PROJETO.md` e define quais fases o agente conduz.

## Comandos durante a conversa

- `pular` — pula a fase atual (quando permitido) e registra isso no `PROJETO.md`.
- `aprovar` — aprova o resumo na Confirmação ou a sugestão de camadas.
- `refazer <fase>` — refaz uma fase inteira a partir da Confirmação (ex.: `refazer ideia`).
- `alterar <resposta>` — volta para uma pergunta específica (ex.: `alterar nucleo`).

## Retomando uma sessão

Ao abrir a CLI em uma pasta que já tem `.mentor/session.json` válido, o Mentor mostra um menu:

```
Encontrei uma sessão anterior: projeto "<pasta>", parou na etapa "FASE 3 [Ideia]".
  [1] Continuar   [2] Começar uma nova (guarda a antiga como backup)
```

- **1** retoma a sessão de onde parou.
- **2** move a sessão antiga para `.mentor/backups/session-<timestamp>.json` e começa do zero.
- **Sessão corrompida ou inválida** é movida para `.mentor/backups/session-<timestamp>.json.bak` e o Mentor começa uma nova, sem erro.
- **Sem sessão**, nada é perguntado e o fluxo começa normalmente.
- Entrada inválida no menu apenas repete a pergunta.

## O que é gerado

Na pasta onde a CLI foi executada:

- `PROJETO.md` — documento vivo com perfil, respostas, decisões e status.
- `Spec.md` e `PRD.md` — criados após a aprovação na Confirmação.
- `.mentor/session.json` — estado da sessão para retomar depois.
- `.mentor/backups/` — backups de sessões anteriores ou corrompidas.
- Arquivos de código das camadas aprovadas na Implementação.

## Desenvolvimento

```bash
npm run typecheck   # checagem de tipos
npm test            # testes (vitest)
npm run build       # compila para dist/
```

## Evals

As evals comparam modelos em 40 casos (accuracy, casos de borda, relevance e robustness) e também medem custo e latência. Veja os detalhes em [`EVALS.md`](EVALS.md).

```bash
npm run evals -- --modelo llama3.2:3b --modelo llama3:latest
```

<!-- RESULTADOS-EVALS -->

## LLMs

Hoje o Mentor fala apenas com o **Ollama**, através de `OllamaLLM`, que implementa a interface `LLM` em `src/core/llm.ts`. O restante do núcleo depende dessa interface, não do Ollama diretamente.

Futuramente, outros provedores (OpenAI, Anthropic etc.) poderão ser adicionados como novos adaptadores, implementando a mesma interface e sendo registrados em `createLLM()`, sem alterar o `engine` nem a CLI.

## Estrutura

```
src/
├── core/   # núcleo sem interface, reaproveitado pela extensão
└── cli/    # entrada e leitura do terminal
tests/      # testes de guards, sessão, documentos e engine
docs/       # prompts de teste, modelos testados
```

## Limitações do MVP

- Revisão e Segurança estão no pós-MVP (ainda não implementadas).
- Cada camada grava um arquivo e sobrescreve o arquivo se ele já existir.
- Os testes propostos no Entendimento não são executados pelo agente.
- A qualidade das perguntas e do código depende do modelo escolhido.
