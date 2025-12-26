import * as vscode from 'vscode';

const KEYS = {
  jiraBaseUrl: 'jira-base-url',
  jiraEmail: 'jira-email',
  jiraApiToken: 'jira-api-token',
  openRouterApiKey: 'openrouter-api-key',
  aiChatModel: 'ai-chat-model',
} as const;

type SecretKey = keyof typeof KEYS;
export type AIProvider = 'openrouter';

export interface AISettings {
  provider: AIProvider;
  chatModel: string;
  embeddingModel: string;
}

export const EMBEDDING_MODEL = 'openai/text-embedding-3-large';

const DEFAULT_MODELS: Record<AIProvider, { chat: string; embedding: string }> = {
  openrouter: {
    chat: '~anthropic/claude-haiku-latest',
    embedding: EMBEDDING_MODEL,
  },
};

const OPENROUTER_CHAT_MODELS = new Set([
  '~anthropic/claude-haiku-latest',
  '~google/gemini-flash-latest',
]);

export class Security {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async get(key: SecretKey): Promise<string | undefined> {
    return this.secrets.get(KEYS[key]);
  }

  async set(key: SecretKey, value: string): Promise<void> {
    await this.secrets.store(KEYS[key], value);
  }

  async delete(key: SecretKey): Promise<void> {
    await this.secrets.delete(KEYS[key]);
  }

  async getJiraConfig(): Promise<{
    baseUrl: string;
    email: string;
    apiToken: string;
  } | null> {
    const baseUrl = await this.get('jiraBaseUrl');
    const email = await this.get('jiraEmail');
    const apiToken = await this.get('jiraApiToken');

    if (!baseUrl || !email || !apiToken) {
      return null;
    }

    return { baseUrl, email, apiToken };
  }

  async getOpenAIKey(): Promise<string | null> {
    return (await this.get('openRouterApiKey')) ?? null;
  }

  async getProviderApiKey(provider: AIProvider): Promise<string | null> {
    return (await this.get('openRouterApiKey')) ?? null;
  }

  async setProviderApiKey(provider: AIProvider, key: string): Promise<void> {
    const trimmed = key.trim();
    if (!trimmed) {
      throw new Error('API key cannot be empty.');
    }

    await this.set('openRouterApiKey', trimmed);
  }

  async hasProviderApiKey(provider: AIProvider): Promise<boolean> {
    const key = await this.getProviderApiKey(provider);
    return Boolean(key && key.trim().length > 0);
  }

  async getAISettings(): Promise<AISettings> {
    const provider: AIProvider = 'openrouter';
    const storedChatModel = (await this.get('aiChatModel'))?.trim() ?? '';
    const chatModel = storedChatModel || DEFAULT_MODELS.openrouter.chat;

    return {
      provider,
      chatModel,
      embeddingModel: DEFAULT_MODELS.openrouter.embedding,
    };
  }

  async setAISettings(settings: Pick<AISettings, 'chatModel'>): Promise<void> {
    const chatModel = settings.chatModel.trim();
    if (!chatModel) {
      throw new Error('Chat model is required.');
    }

    await this.set('aiChatModel', chatModel);
  }

  getDefaultModels(provider: AIProvider): { chat: string; embedding: string } {
    return DEFAULT_MODELS[provider];
  }

  // Prompts user to enter credentials via VS Code input boxes
  async promptJiraConfig(): Promise<boolean> {
    const baseUrl = await vscode.window.showInputBox({
      title: 'Jira Base URL',
      prompt: 'Enter your Jira instance URL',
      placeHolder: 'https://yourcompany.atlassian.net',
      ignoreFocusOut: true,
    });
    if (!baseUrl) return false;

    const email = await vscode.window.showInputBox({
      title: 'Jira Email',
      prompt: 'Enter the email associated with your Jira account',
      placeHolder: 'you@example.com',
      ignoreFocusOut: true,
    });
    if (!email) return false;

    const apiToken = await vscode.window.showInputBox({
      title: 'Jira API Token',
      prompt: 'Enter your Jira API token (from id.atlassian.com/manage-profile/security/api-tokens)',
      password: true,
      ignoreFocusOut: true,
    });
    if (!apiToken) return false;

    await this.set('jiraBaseUrl', baseUrl);
    await this.set('jiraEmail', email);
    await this.set('jiraApiToken', apiToken);

    return true;
  }

  async promptOpenAIKey(): Promise<boolean> {
    const key = await vscode.window.showInputBox({
      title: 'OpenRouter API Key',
      prompt: 'Enter your OpenRouter API key (from openrouter.ai/keys)',
      password: true,
      ignoreFocusOut: true,
    });
    if (!key) return false;

    await this.set('openRouterApiKey', key);
    return true;
  }

  async hasJiraCredentials(): Promise<boolean> {
    const jira = await this.getJiraConfig();
    return jira !== null;
  }

  // Returns true if all credentials are present
  async hasAllCredentials(): Promise<boolean> {
    const jira = await this.hasJiraCredentials();
    const { provider } = await this.getAISettings();
    const aiKey = await this.hasProviderApiKey(provider);
    return jira && aiKey;
  }
}