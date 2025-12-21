import * as https from 'https';

export interface OpenAIConfig {
  apiKey: string;
}

export type AIProvider = 'openai' | 'openrouter';

export interface RuntimeAIConfig {
  provider: AIProvider;
  apiKey: string;
  chatModel: string;
  embeddingModel: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class OpenAIClient {
  private keyResolver?: () => Promise<string>;
  private runtimeResolver?: () => Promise<RuntimeAIConfig>;

  constructor(private config: OpenAIConfig) {}

  // Allow late binding of key resolver so Security module can inject it
  setKeyResolver(resolver: () => Promise<string>) {
    this.keyResolver = resolver;
  }

  setRuntimeResolver(resolver: () => Promise<RuntimeAIConfig>) {
    this.runtimeResolver = resolver;
  }

  private async resolveKey(): Promise<string> {
    if (this.keyResolver) {
      return this.keyResolver();
    }
    return this.config.apiKey;
  }

  private async resolveRuntime(): Promise<RuntimeAIConfig> {
    if (this.runtimeResolver) {
      return this.runtimeResolver();
    }

    return {
      provider: 'openai',
      apiKey: await this.resolveKey(),
      chatModel: '~anthropic/claude-sonnet-latest',
      embeddingModel: 'openai/text-embedding-3-large',
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    const runtime = await this.resolveRuntime();
    const batches = this._chunk(texts, 2048);
    const results: number[][] = [];

    for (const batch of batches) {
      const response = await this._post('/v1/embeddings', {
        model: runtime.embeddingModel,
        input: batch,
      }, runtime);
      const embeddings = (response as {
        data: { embedding: number[] }[];
      }).data.map((d) => d.embedding);
      results.push(...embeddings);
    }

    return results;
  }

  async chat(
    messages: ChatMessage[],
    responseFormat: 'text' | 'json' = 'text',
    timeoutMs = 30000
  ): Promise<string> {
    const runtime = await this.resolveRuntime();
    const maxTokens = responseFormat === 'json' ? 4096 : 1024;
    const body: Record<string, unknown> = {
      model: runtime.chatModel,
      messages,
      temperature: 0.2,
      max_tokens: maxTokens,
    };

    if (responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const response = await this._post('/v1/chat/completions', body, runtime, timeoutMs);
    const result = response as {
      choices: { message: { content: string } }[];
    };

    return result.choices[0].message.content;
  }

  private async _post(
    path: string,
    body: unknown,
    runtime: RuntimeAIConfig,
    timeoutMs = 30000
  ): Promise<unknown> {
    const host = runtime.provider === 'openrouter' ? 'openrouter.ai' : 'api.openai.com';
    const apiPath = runtime.provider === 'openrouter' ? `/api${path}` : path;
    const providerName = runtime.provider === 'openrouter' ? 'OpenRouter' : 'OpenAI';

    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);

      const headers: Record<string, string | number> = {
        Authorization: `Bearer ${runtime.apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      };

      if (runtime.provider === 'openrouter') {
        headers['X-Title'] = 'Ticket to Code Orchestrator';
      }

      const options = {
        hostname: host,
        path: apiPath,
        method: 'POST',
        headers,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error(`Failed to parse ${providerName} response as JSON`));
            }
          } else if (res.statusCode === 401) {
            reject(new Error(`${providerName} authentication failed. Check your API key.`));
          } else if (res.statusCode === 429) {
            reject(new Error(`${providerName} rate limit hit. Please wait and try again.`));
          } else {
            reject(new Error(`${providerName} API error: HTTP ${res.statusCode} — ${data}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Network error reaching ${providerName}: ${err.message}`));
      });

      req.setTimeout(timeoutMs, () => {
        req.destroy();
        reject(new Error(`${providerName} request timed out after ${timeoutMs / 1000}s`));
      });

      req.write(payload);
      req.end();
    });
  }

  private _chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}