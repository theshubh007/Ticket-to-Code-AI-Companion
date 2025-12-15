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
  private agent = new https.Agent({ keepAlive: true, maxSockets: 5 });

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
        model: 'Qwen/Qwen3-Embedding-8B',
        input: batch,
      }, 120000, 'api.tokenfactory.nebius.com');
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
    timeoutMs = 120000
  ): Promise<string> {
    // Map internal ChatMessage format to Nebius expected format
    const formattedMessages = messages.map(msg => {
      if (msg.role === 'user') {
        return {
          role: msg.role,
          content: [
            {
              type: 'text',
              text: msg.content
            }
          ]
        };
      }
      return {
        role: msg.role,
        content: msg.content
      };
    });

    const body: Record<string, unknown> = {
      model: 'nvidia/nemotron-3-super-120b-a12b',
      messages: formattedMessages,
      temperature: 0.2,
    };

    if (responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const response = await this._post('/v1/chat/completions', body, timeoutMs, 'api.tokenfactory.us-central1.nebius.com');
    const result = response as {
      choices: { message: { content: string } }[];
    };

    return result.choices[0].message.content;
  }

  private async _post(path: string, body: unknown, timeoutMs = 120000, hostname = 'api.tokenfactory.nebius.com', retries = 3): Promise<unknown> {
    const apiKey = await this.resolveKey();

    for (let i = 0; i < retries; i++) {
      try {
        return await new Promise((resolve, reject) => {
          const payload = JSON.stringify(body);

          const options = {
            hostname,
            path,
            method: 'POST',
            agent: this.agent,
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
                  reject(new Error('Failed to parse TokenFactory response as JSON'));
                }
              } else if (res.statusCode === 401) {
                reject(new Error('TokenFactory authentication failed. Check your API key.'));
              } else if (res.statusCode === 429) {
                reject(new Error('TokenFactory rate limit hit. Please wait and try again.'));
              } else {
                reject(new Error(`TokenFactory API error: HTTP ${res.statusCode} — ${data}`));
              }
            });
          });

          req.on('error', (err) => {
            reject(new Error(`Network error reaching TokenFactory: ${err.message}`));
          });

          req.setTimeout(timeoutMs, () => {
            req.destroy();
            reject(new Error(`TokenFactory request timed out after ${timeoutMs / 1000}s`));
          });

          req.write(payload);
          req.end();
        });
      } catch (err: any) {
        const isTransient = err.message.includes('socket hang up') || 
                          err.message.includes('ECONNRESET') || 
                          err.message.includes('timed out');
        
        if (isTransient && i < retries - 1) {
          // Exponential backoff
          await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
          continue;
        }
        throw err;
      }
    }
  }

  private _chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}