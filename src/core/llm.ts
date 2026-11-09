export type Role = "system" | "user" | "assistant";
export type Msg = { role: Role; content: string };

export interface LLM {
  readonly model: string;
  chat(messages: Msg[]): Promise<string>;
  listModels(): Promise<string[]>;
  checkModel(): Promise<boolean>;
}

export type OllamaOptions = {
  baseUrl?: string;
  model?: string;
};

type ChatResponse = {
  message: { role: string; content: string };
};

type TagsResponse = {
  models: { name: string }[];
};

export class OllamaLLM implements LLM {
  readonly model: string;
  private readonly baseUrl: string;

  constructor(options: OllamaOptions = {}) {
    this.baseUrl =
      options.baseUrl ?? process.env.OLLAMA_URL ?? "http://localhost:11434";
    this.model =
      options.model ?? process.env.MENTOR_MODEL ?? "llama3.2:3b";
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;

    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      const cause = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Não consegui falar com o Ollama em ${this.baseUrl}. Ele está rodando? (${cause})`,
      );
    }

    if (!res.ok) {
      throw new Error(`Ollama respondeu ${res.status}: ${await res.text()}`);
    }

    return (await res.json()) as T;
  }

  async chat(messages: Msg[]): Promise<string> {
    const data = await this.request<ChatResponse>("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, messages, stream: false }),
    });

    return data.message.content;
  }

  async listModels(): Promise<string[]> {
    const data = await this.request<TagsResponse>("/api/tags");
    return data.models.map((model) => model.name);
  }

  async checkModel(): Promise<boolean> {
    const models = await this.listModels();
    return models.some(
      (name) => name === this.model || name.startsWith(`${this.model}:`),
    );
  }
}

export type LLMProvider = "ollama";

const providers: Record<LLMProvider, () => LLM> = {
  ollama: () => new OllamaLLM(),
};

export function createLLM(provider: LLMProvider = "ollama"): LLM {
  return providers[provider]();
}
