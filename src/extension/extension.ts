import * as vscode from 'vscode';
import { SidebarProvider } from './sidebar/SidebarProvider';
import { Security } from './engine/Security';

export function activate(context: vscode.ExtensionContext) {
  console.log('Ticket to Code: activating...');

  const security = new Security(context.secrets);

  const provider = new SidebarProvider(context.extensionUri, security);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'ticket-to-code.sidebar',
      provider
    )
  );

  // Register command to reset credentials
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ticket-to-code.resetCredentials',
      async () => {
        await security.delete('jiraBaseUrl');
        await security.delete('jiraEmail');
        await security.delete('jiraApiToken');
        await security.delete('openAiApiKey');
        vscode.window.showInformationMessage(
          'Ticket to Code: all credentials cleared.'
        );
      }
    )
  );

  console.log('Ticket to Code: active ✓');
}

export function deactivate() {}