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

## O que é gerado

Na pasta onde a CLI foi executada:

- `PROJETO.md` — documento vivo com perfil, respostas, decisões e status.
- `Spec.md` e `PRD.md` — criados após a aprovação na Confirmação.
- `.mentor/session.json` — estado da sessão para retomar depois.
- Arquivos de código das camadas aprovadas na Implementação.

## Desenvolvimento

```bash
npm run typecheck   # checagem de tipos
npm test            # testes (vitest)
npm run build       # compila para dist/
```

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
