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
  it('returns the stored model slug as-is from getAISettings', async () => {
    const secrets = createSecretStorage({ 'ai-chat-model': 'anthropic/claude-3-5-sonnet' });
    const security = new Security(secrets);

    await expect(security.getAISettings()).resolves.toMatchObject({
      provider: 'openrouter',
      chatModel: 'anthropic/claude-3-5-sonnet',
    });
  });

  it('falls back to the default model when no model is stored', async () => {
    const secrets = createSecretStorage();
    const security = new Security(secrets);

    await expect(security.getAISettings()).resolves.toMatchObject({
      provider: 'openrouter',
      chatModel: '~anthropic/claude-haiku-latest',
    });
  });

  it('accepts any non-empty model slug when saving AI settings', async () => {
    const secrets = createSecretStorage();
    const security = new Security(secrets);

    await expect(
      security.setAISettings({ chatModel: 'google/gemini-2.0-flash' })
    ).resolves.toBeUndefined();
  });

  it('rejects an empty model slug when saving AI settings', async () => {
    const secrets = createSecretStorage();
    const security = new Security(secrets);

    await expect(
      security.setAISettings({ chatModel: '   ' })
    ).rejects.toThrow('Chat model is required');
  });
});
