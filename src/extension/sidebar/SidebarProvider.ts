import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Security } from '../engine/Security';
import { TicketManager } from '../engine/TicketManager';
import { CodeAnalyzer } from '../engine/CodeAnalyzer';
import { AIEngine } from '../engine/AIEngine';
import {
  MessageFromWebview,
  MessageToWebview,
  CodeChunk,
  TicketData,
} from '../types';
import { openFileAtRange, getWorkspaceRoot } from '../utils/editorNavigation';
import {
  buildContext,
  deduplicateChunks,
  boostByFileType,
} from '../utils/contextManager';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _lastTicket?: TicketData;
  private _lastChunks?: CodeChunk[];

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _security: Security,
    private readonly _ticketManager: TicketManager,
    private readonly _codeAnalyzer: CodeAnalyzer,
    private readonly _aiEngine: AIEngine
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
          case 'getAISettings':
            await this._handleGetAISettings();
            break;
          case 'saveAISettings':
            await this._handleSaveAISettings(message.payload);
            break;
          case 'listTickets':
            await this._handleListTickets();
            break;
          case 'fetchTicket':
            await this._handleFetchTicket(message.payload.key);
            break;
          case 'analyzeRepo':
            await this._handleAnalyzeRepo(message.payload.ticketDescription);
            break;
          case 'generateGuide':
            await this._handleGenerateGuide();
            break;
          case 'openFile': {
            const { filePath, startLine, endLine } = message.payload;
            const root = getWorkspaceRoot();
            await openFileAtRange(filePath, startLine, endLine, root);
            break;
          }
          default:
            console.warn('SidebarProvider: unknown command');
        }
      }
    );
  }

  private async _handleListTickets(): Promise<void> {
    const hasJiraCredentials = await this._security.hasJiraCredentials();
    if (!hasJiraCredentials) {
      const jiraOk = await this._security.promptJiraConfig();
      if (!jiraOk) {
        this._post({ command: 'ticketListError', payload: 'Jira credentials are required.' });
        return;
      }
    }

    try {
      const tickets = await this._ticketManager.listAssignedTickets();
      this._post({ command: 'ticketList', payload: tickets });
    } catch (err) {
      this._post({ command: 'ticketListError', payload: (err as Error).message });
    }
  }

  private async _handleFetchTicket(key: string): Promise<void> {
    if (!key.trim()) {
      this._post({ command: 'ticketError', payload: 'Please enter a valid issue key.' });
      return;
    }

    const hasJiraCredentials = await this._security.hasJiraCredentials();
    if (!hasJiraCredentials) {
      const jiraOk = await this._security.promptJiraConfig();
      if (!jiraOk) {
        this._post({ command: 'ticketError', payload: 'Jira credentials are required.' });
        return;
      }
    }

    try {
      const ticket = await this._ticketManager.fetchTicket(key.trim().toUpperCase());
      this._lastTicket = ticket;
      this._post({ command: 'ticketResult', payload: ticket });
    } catch (err) {
      this._post({ command: 'ticketError', payload: (err as Error).message });
    }
  }

  private async _handleAnalyzeRepo(ticketDescription: string): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) {
      this._post({ command: 'analysisError', payload: 'No workspace folder open.' });
      return;
    }

    const aiConfigError = await this._getAIConfigError();
    if (aiConfigError) {
      this._post({ command: 'analysisError', payload: aiConfigError });
      return;
    }

    try {
      await this._codeAnalyzer.indexWorkspace(root, (current, total) => {
        this._post({ command: 'indexingProgress', payload: { current, total } });
      });

      const rawChunks = await this._codeAnalyzer.search(ticketDescription, 20);
      const deduped = deduplicateChunks(rawChunks);
      const boosted = boostByFileType(deduped);
      const { chunks } = buildContext(
        boosted,
        this._lastTicket ?? {
          key: '',
          summary: '',
          description: ticketDescription,
          acceptanceCriteria: '',
          status: '',
          priority: '',
          labels: [],
          issueType: '',
        }
      );

      this._lastChunks = chunks;
      this._post({ command: 'analysisResult', payload: chunks });
    } catch (err) {
      this._post({ command: 'analysisError', payload: (err as Error).message });
    }
  }

  private async _handleGenerateGuide(): Promise<void> {
    if (!this._lastTicket || !this._lastChunks) {
      this._post({
        command: 'guideError',
        payload: 'Fetch a ticket and analyze the repo first.',
      });
      return;
    }

    const aiConfigError = await this._getAIConfigError();
    if (aiConfigError) {
      this._post({ command: 'guideError', payload: aiConfigError });
      return;
    }

    try {
      const guide = await this._aiEngine.generateGuide(
        this._lastTicket,
        this._lastChunks
      );
      this._post({ command: 'guideResult', payload: guide });
    } catch (err) {
      this._post({ command: 'guideError', payload: (err as Error).message });
    }
  }

  private async _handleGetAISettings(): Promise<void> {
    try {
      const settings = await this._security.getAISettings();
      const hasApiKey = await this._security.hasProviderApiKey(settings.provider);

      this._post({
        command: 'aiSettings',
        payload: {
          chatModel: settings.chatModel,
          hasApiKey,
        },
      });
    } catch (err) {
      this._post({
        command: 'aiSettingsError',
        payload: `Failed to load AI settings: ${(err as Error).message}`,
      });
    }
  }

  private async _handleSaveAISettings(payload: {
    chatModel: string;
    apiKey?: string;
  }): Promise<void> {
    try {
      const chatModel = payload.chatModel.trim();
      if (!chatModel) {
        throw new Error('Chat model is required.');
      }

      await this._security.setAISettings({ chatModel });

      const key = payload.apiKey?.trim() ?? '';
      if (key) {
        await this._security.setProviderApiKey('openrouter', key);
      }

      this._post({ command: 'aiSettingsSaved', payload: 'AI settings saved.' });
      await this._handleGetAISettings();
    } catch (err) {
      this._post({
        command: 'aiSettingsError',
        payload: (err as Error).message,
      });
    }
  }

  private async _getAIConfigError(): Promise<string | null> {
    const settings = await this._security.getAISettings();
    const hasApiKey = await this._security.hasProviderApiKey('openrouter');
    if (!hasApiKey) {
      return 'Missing OpenRouter API key. Open AI Settings and save your key.';
    }

    if (!settings.chatModel.trim()) {
      return 'AI model settings are incomplete. Open AI Settings and provide a chat model.';
    }

    return null;
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

    // Generate a cryptographic nonce for CSP
    const nonce = crypto.randomBytes(16).toString('base64');

    // Rewrite asset paths to webview URIs
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

    // Inject strict CSP into <head>
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}' ${webview.cspSource}`,
      `img-src ${webview.cspSource} data:`,
      `font-src ${webview.cspSource}`,
      `connect-src 'none'`,
    ].join('; ');

    html = html.replace(
      '<head>',
      `<head>\n  <meta http-equiv="Content-Security-Policy" content="${csp}">`
    );

    // Add nonce to all script tags
    html = html.replace(/<script /g, `<script nonce="${nonce}" `);

    return html;
  }
}