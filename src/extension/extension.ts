import * as vscode from 'vscode';
import { SidebarProvider } from './sidebar/SidebarProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('Ticket to Code: activating...');

  const provider = new SidebarProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'ticket-to-code.sidebar',
      provider
    )
  );

  console.log('Ticket to Code: active ✓');
}

export function deactivate() {}