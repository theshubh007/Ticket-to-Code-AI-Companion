import * as vscode from 'vscode';
import { SidebarProvider } from './sidebar/SidebarProvider';
import { Security } from './engine/Security';
import { CacheManager } from './engine/CacheManager';
import { TicketManager } from './engine/TicketManager';
import { CodeAnalyzer } from './engine/CodeAnalyzer';
import { AIEngine } from './engine/AIEngine';
import { OpenAIClient } from './clients/OpenAIClient';

export function activate(context: vscode.ExtensionContext) {
  console.log('Ticket to Code: activating...');

  const security = new Security(context.secrets);
  const cache = new CacheManager(context.globalStoragePath);

  // OpenRouter client with runtime key resolution from SecretStorage
  const openAIClient = new OpenAIClient({ apiKey: '' });
  openAIClient.setRuntimeResolver(async () => {
    const settings = await security.getAISettings();
    const key = await security.getProviderApiKey('openrouter');
    if (!key) {
      throw new Error(
        'OpenRouter API key not configured. Open settings and add your key.'
      );
    }

    return {
      provider: 'openrouter',
      apiKey: key,
      chatModel: settings.chatModel,
      embeddingModel: settings.embeddingModel,
    };
  });

  const ticketManager = new TicketManager(security, cache);
  const codeAnalyzer = new CodeAnalyzer(openAIClient, cache);
  const aiEngine = new AIEngine(openAIClient);

  const provider = new SidebarProvider(
    context.extensionUri,
    security,
    ticketManager,
    codeAnalyzer,
    aiEngine,
    context.workspaceState
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'ticket-to-code.sidebar',
      provider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ticket-to-code.resetCredentials',
      async () => {
        await security.delete('jiraBaseUrl');
        await security.delete('jiraEmail');
        await security.delete('jiraApiToken');
        await security.delete('openRouterApiKey');
        await security.delete('aiChatModel');
        vscode.window.showInformationMessage(
          'Ticket to Code: all credentials cleared.'
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ticket-to-code.clearIndex',
      async () => {
        await cache.clearEmbeddingIndex();
        vscode.window.showInformationMessage(
          'Ticket to Code: embedding index cleared.'
        );
      }
    )
  );

  console.log('Ticket to Code: active ✓');
}

export function deactivate() {}