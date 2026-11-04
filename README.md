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
