import * as vscode from 'vscode';

const KEYS = {
  jiraBaseUrl: 'jira-base-url',
  jiraEmail: 'jira-email',
  jiraApiToken: 'jira-api-token',
  openAiApiKey: 'openai-api-key',
} as const;

type SecretKey = keyof typeof KEYS;

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
    return (await this.get('openAiApiKey')) ?? null;
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
      title: 'OpenAI API Key',
      prompt: 'Enter your OpenAI API key (from platform.openai.com/api-keys)',
      password: true,
      ignoreFocusOut: true,
    });
    if (!key) return false;

    await this.set('openAiApiKey', key);
    return true;
  }

  // Returns true if all credentials are present
  async hasAllCredentials(): Promise<boolean> {
    const jira = await this.getJiraConfig();
    const openai = await this.getOpenAIKey();
    return jira !== null && openai !== null;
  }
}