# Mentor

A IA que te faz pensar, não que pensa por você.

## Instalação

1. Instale o [Ollama](https://ollama.com/) e baixe um modelo.
2. Clone este repositório e instale as dependências.
3. Rode a CLI dentro da pasta do projeto do aluno.

```bash
ollama serve
ollama pull <modelo>
npm install
npm start
```

A CLI conversa com o Ollama em `http://localhost:11434`.

## Modos de uso

Depois de conhecer o aluno, o Mentor pergunta o que ele quer fazer:

- **Criar um projeto:** fluxo completo de ideia, requisitos, arquitetura e implementação em camadas.
- **Resolver um problema de estrutura de dados/algoritmos:** o agente colhe o enunciado e desenha a solução apenas logicamente, em passos e sem código, antes de o aluno implementar.

O modo escolhido (`projeto` ou `algoritmo`) fica registrado no `PROJETO.md` e define quais fases o agente conduz.

## LLMs

Hoje o Mentor fala apenas com o **Ollama**, através de `OllamaLLM`, que implementa a interface `LLM` em `src/core/llm.ts`. O restante do núcleo depende dessa interface, não do Ollama diretamente.

Futuramente, outros provedores (OpenAI, Anthropic etc.) poderão ser adicionados como novos adaptadores, implementando a mesma interface e sendo registrados em `createLLM()`, sem alterar o `engine` nem a CLI.

## Estrutura

```
src/
├── core/   # núcleo sem interface, reaproveitado pela extensão
└── cli/    # entrada e leitura do terminal
tests/      # testes do guards e do engine
docs/       # prompts de teste, modelos testados
```

## Documento vivo

A CLI cria no projeto do aluno:

- `PROJETO.md` na raiz.
- `.mentor/session.json` com o estado da sessão.
