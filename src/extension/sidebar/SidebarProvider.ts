import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

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
      (message: { command: string; payload?: unknown }) => {
        switch (message.command) {
          case 'ping':
            this._post({ command: 'pong', payload: 'Connection established ✓' });
            break;
          default:
            console.warn(`SidebarProvider: unknown command "${message.command}"`);
        }
      }
    );
  }

  private _post(message: { command: string; payload?: unknown }) {
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

    // Rewrite relative asset paths to proper webview URIs
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