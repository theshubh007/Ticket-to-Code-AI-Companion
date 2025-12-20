import { Security } from '../../engine/Security';

function createSecretStorage(initialValues: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initialValues));

  return {
    get: jest.fn(async (key: string) => store.get(key)),
    store: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  } as unknown as import('vscode').SecretStorage;
}

describe('Security', () => {
  it('normalizes unsupported OpenRouter models to the default working model', async () => {
    const secrets = createSecretStorage({ 'ai-chat-model': 'anthropic/claude-haiku-lates' });
    const security = new Security(secrets);

    await expect(security.getAISettings()).resolves.toMatchObject({
      provider: 'openrouter',
      chatModel: '~anthropic/claude-haiku-latest',
    });
  });

  it('normalizes the removed OpenAI model to the default working model', async () => {
    const secrets = createSecretStorage({ 'ai-chat-model': 'openai/gpt-mini-latest' });
    const security = new Security(secrets);

    await expect(security.getAISettings()).resolves.toMatchObject({
      provider: 'openrouter',
      chatModel: '~anthropic/claude-haiku-latest',
    });
  });

  it('rejects unsupported models when saving AI settings', async () => {
    const secrets = createSecretStorage();
    const security = new Security(secrets);

    await expect(
      security.setAISettings({ chatModel: 'anthropic/claude-haiku-lates' })
    ).rejects.toThrow('Unsupported OpenRouter model');
  });
});
