import * as https from 'https';

export interface OpenAIConfig {
  apiKey: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class OpenAIClient {
  private keyResolver?: () => Promise<string>;

  constructor(private config: OpenAIConfig) {}

  // Allow late binding of key resolver so Security module can inject it
  setKeyResolver(resolver: () => Promise<string>) {
    this.keyResolver = resolver;
  }

  private async resolveKey(): Promise<string> {
    if (this.keyResolver) {
      return this.keyResolver();
    }
    return this.config.apiKey;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const batches = this._chunk(texts, 2048);
    const results: number[][] = [];

    for (const batch of batches) {
      const response = await this._post('/v1/embeddings', {
        model: 'text-embedding-3-small',
        input: batch,
      });
      const embeddings = (response as {
        data: { embedding: number[] }[];
      }).data.map((d) => d.embedding);
      results.push(...embeddings);
    }

    return results;
  }

  async chat(
    messages: ChatMessage[],
    responseFormat: 'text' | 'json' = 'text'
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.2,
    };

    if (responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const response = await this._post('/v1/chat/completions', body);
    const result = response as {
      choices: { message: { content: string } }[];
    };

    return result.choices[0].message.content;
  }

  private async _post(path: string, body: unknown): Promise<unknown> {
    const apiKey = await this.resolveKey();

    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);

      const options = {
        hostname: 'api.openai.com',
        path,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error('Failed to parse OpenAI response as JSON'));
            }
          } else if (res.statusCode === 401) {
            reject(new Error('OpenAI authentication failed. Check your API key.'));
          } else if (res.statusCode === 429) {
            reject(new Error('OpenAI rate limit hit. Please wait and try again.'));
          } else {
            reject(new Error(`OpenAI API error: HTTP ${res.statusCode} — ${data}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Network error reaching OpenAI: ${err.message}`));
      });

      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('OpenAI request timed out after 30s'));
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