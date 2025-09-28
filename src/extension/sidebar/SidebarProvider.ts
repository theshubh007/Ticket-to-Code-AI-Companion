import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Security } from '../engine/Security';
import { MessageFromWebview, MessageToWebview } from '../types';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _security: Security
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview'),
      ],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      async (message: MessageFromWebview) => {
        switch (message.command) {
          case 'ping':
            this._post({ command: 'pong', payload: 'Connection established ✓' });
            break;

          case 'fetchTicket': {
            const hasCredentials = await this._security.hasAllCredentials();
            if (!hasCredentials) {
              const jiraOk = await this._security.promptJiraConfig();
              if (!jiraOk) {
                this._post({ command: 'ticketError', payload: 'Jira credentials are required.' });
                return;
              }
              const openAiOk = await this._security.promptOpenAIKey();
              if (!openAiOk) {
                this._post({ command: 'ticketError', payload: 'OpenAI API key is required.' });
                return;
              }
            }
            // TicketManager wired in next sprint
            this._post({ command: 'ticketError', payload: 'TicketManager not yet implemented.' });
            break;
          }

          case 'openFile': {
            const { filePath, startLine, endLine } = message.payload;
            const uri = vscode.Uri.file(filePath);
            const doc = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(doc);
            const range = new vscode.Range(startLine, 0, endLine, 0);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            editor.selection = new vscode.Selection(range.start, range.end);
            break;
          }

          default:
            console.warn(`SidebarProvider: unknown command`);
        }
      }
    );
  }

  private _post(message: MessageToWebview) {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const distWebviewPath = vscode.Uri.joinPath(
      this._extensionUri,
      'dist',
      'webview'
    );
    const htmlPath = path.join(distWebviewPath.fsPath, 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf-8');

    html = html.replace(
      /(src|href)="(\.\/[^"]+)"/g,
      (_match, attr, relativePath) => {
        const filePath = relativePath.replace('./', '');
        const uri = webview.asWebviewUri(
          vscode.Uri.joinPath(distWebviewPath, filePath)
        );
        return `${attr}="${uri}"`;
      }
    );

    return html;
  }
}