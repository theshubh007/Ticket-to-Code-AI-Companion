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
  ImplementationGuide,
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
  private _lastGuide?: ImplementationGuide;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _security: Security,
    private readonly _ticketManager: TicketManager,
    private readonly _codeAnalyzer: CodeAnalyzer,
    private readonly _aiEngine: AIEngine,
    private readonly _workspaceState: vscode.Memento
  ) {
    this._lastTicket = _workspaceState.get<TicketData>('lastTicket');
    this._lastGuide = _workspaceState.get<ImplementationGuide>('lastGuide');
  }

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
          case 'implement':
            await this._handleImplement();
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
    const hasCredentials = await this._security.hasAllCredentials();
    if (!hasCredentials) {
      const jiraOk = await this._security.promptJiraConfig();
      if (!jiraOk) {
        this._post({ command: 'ticketListError', payload: 'Jira credentials are required.' });
        return;
      }
      const openAiOk = await this._security.promptOpenAIKey();
      if (!openAiOk) {
        this._post({ command: 'ticketListError', payload: 'OpenAI API key is required.' });
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

    try {
      const ticket = await this._ticketManager.fetchTicket(key.trim().toUpperCase());
      this._lastTicket = ticket;
      await this._workspaceState.update('lastTicket', ticket);
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
    if (!this._lastTicket) {
      this._post({ command: 'guideError', payload: 'Select a ticket first.' });
      return;
    }
    if (!this._lastChunks) {
      this._post({ command: 'guideError', payload: 'Analyze the repo first — click "Analyze" in the Code Analysis panel.' });
      return;
    }

    try {
      const guide = await this._aiEngine.generateGuide(
        this._lastTicket,
        this._lastChunks
      );
      this._lastGuide = guide;
      await this._workspaceState.update('lastGuide', guide);
      this._post({ command: 'guideResult', payload: guide });
    } catch (err) {
      this._post({ command: 'guideError', payload: (err as Error).message });
    }
  }

  private async _handleImplement(): Promise<void> {
    if (!this._lastTicket || !this._lastGuide) {
      this._post({
        command: 'implementError',
        payload: 'Generate a guide first before implementing.',
      });
      return;
    }

    const root = getWorkspaceRoot();
    if (!root) {
      this._post({ command: 'implementError', payload: 'No workspace folder open.' });
      return;
    }

    const ticket = this._lastTicket;
    const guide = this._lastGuide;
    const total = guide.steps.length;
    const filesModified: string[] = [];

    try {
      for (const step of guide.steps) {
        // Collect unique file paths referenced in this step
        const uniquePaths = Array.from(new Set(step.fileReferences.map((r) => r.filePath)));

        // Signal: reading phase
        this._post({
          command: 'implementProgress',
          payload: { step: step.stepNumber, total, stepTitle: step.title, phase: 'reading' },
        });

        // Read current contents of each referenced file
        const fileContents = new Map<string, string>();
        for (const relPath of uniquePaths) {
          const absUri = vscode.Uri.joinPath(vscode.Uri.file(root), relPath);
          try {
            const bytes = await vscode.workspace.fs.readFile(absUri);
            fileContents.set(relPath, Buffer.from(bytes).toString('utf-8'));
          } catch {
            // File may not exist yet — pass empty string so AI can create it
            fileContents.set(relPath, '');
          }
        }

        // Signal: generating phase
        this._post({
          command: 'implementProgress',
          payload: { step: step.stepNumber, total, stepTitle: step.title, phase: 'generating' },
        });

        // Ask AI to produce the edits for this step
        const edits = await this._aiEngine.applyStep(ticket, step, fileContents);

        // Apply each edit via string replacement and write back to disk
        for (const edit of edits) {
          const absUri = vscode.Uri.joinPath(vscode.Uri.file(root), edit.filePath);
          const current = fileContents.get(edit.filePath) ?? '';

          let updated: string;
          if (edit.startLine === 0) {
            // Append to end of file
            updated = current + (current.endsWith('\n') ? '' : '\n') + edit.replacement;
          } else {
            const lines = current.split('\n');
            const start = edit.startLine - 1;         // convert to 0-based
            const end = edit.endLine;                 // slice end is exclusive, so no -1
            if (start < 0 || start > lines.length || end < start) {
              throw new Error(
                `Step ${step.stepNumber}: line range ${edit.startLine}–${edit.endLine} is out of bounds ` +
                `for ${edit.filePath} (${lines.length} lines).`
              );
            }
            updated = [
              ...lines.slice(0, start),
              edit.replacement,
              ...lines.slice(end),
            ].join('\n');
          }

          await vscode.workspace.fs.writeFile(absUri, Buffer.from(updated, 'utf-8'));
          // Keep fileContents up to date so later edits in the same step see the new state
          fileContents.set(edit.filePath, updated);

          if (!filesModified.includes(edit.filePath)) {
            filesModified.push(edit.filePath);
          }
          this._post({
            command: 'implementProgress',
            payload: { step: step.stepNumber, total, stepTitle: step.title, phase: 'writing', filePath: edit.filePath },
          });
        }
      }

      this._post({ command: 'implementResult', payload: { filesModified } });
    } catch (err) {
      this._post({ command: 'implementError', payload: (err as Error).message });
    }
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