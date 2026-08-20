import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { OpenAIClient } from '../clients/OpenAIClient';
import { CodeAnalyzer } from '../engine/CodeAnalyzer';
import { proposeTicketChange } from '../engine/TicketAgent';
import { FileDiff, TicketAgentStatus, TicketData } from '../types';
import { getWorkspaceRoot } from '../utils/editorNavigation';

async function existingFile(root: string, relative: string): Promise<vscode.Uri> {
  const base = await fs.realpath(root);
  const target = path.resolve(base, relative);
  const inside = path.relative(base, target);
  if (!inside || inside.startsWith('..' + path.sep) || inside === '..' ||
      path.isAbsolute(relative) || (await fs.realpath(target)) !== target ||
      !(await fs.stat(target)).isFile()) {
    throw new Error('Choose an existing workspace file without symbolic links.');
  }
  // Keep the workspace spelling so VS Code edits the already-open document, even for an aliased root.
  return vscode.Uri.file(path.join(root, relative));
}

async function readTarget(root: string, filePath: string) {
  const uri = await existingFile(root, filePath);
  const doc = await vscode.workspace.openTextDocument(uri);
  if (doc.isDirty) throw new Error('Save your changes in ' + filePath + ' and run the preview again.');
  const disk = await fs.readFile(uri.fsPath, 'utf8');
  if (disk.replace(/^\uFEFF/, '') !== doc.getText()) {
    throw new Error('The editor and disk contents differ. Reopen ' + filePath + ' and preview again.');
  }
  return doc;
}

export class TicketPreview implements vscode.TextDocumentContentProvider {
  private status?: TicketAgentStatus;
  private diff?: FileDiff;
  private root?: string;

  constructor(
    private readonly client: Pick<OpenAIClient, 'agentTurn'>,
    private readonly analyzer: Pick<CodeAnalyzer, 'indexWorkspace' | 'search'>,
    private readonly notify: (status: TicketAgentStatus) => void,
    readonly scheme = 'ticket-to-code-preview'
  ) {}

  replay() {
    if (this.status) this.notify(this.status);
  }

  reset() {
    this.status = undefined;
    this.diff = undefined;
    this.root = undefined;
  }

  private update(phase: TicketAgentStatus['phase'], message: string) {
    if (!this.status) return;
    this.status = { ...this.status, phase, message };
    this.notify(this.status);
  }

  private check(id: string) {
    if (this.status?.id !== id || this.root !== getWorkspaceRoot()) {
      throw new Error('The active ticket or workspace has changed.');
    }
  }

  async start(ticket: TicketData) {
    if (this.status?.phase === 'applying') return;
    this.reset();
    const id = randomUUID();
    const root = getWorkspaceRoot();
    this.root = root;
    this.status = { id, ticketKey: ticket.key, phase: 'running', message: '' };
    this.update('running', 'Indexing the workspace…');
    try {
      if (!root) throw new Error('Open a workspace folder first.');
      await this.analyzer.indexWorkspace(root);
      const diff = await proposeTicketChange(this.client, ticket, {
        checkActive: () => this.check(id),
        search: query => this.analyzer.search(query, 5, root),
        read: async file => (await readTarget(root, file)).getText(),
        progress: message => {
          this.check(id);
          this.update('running', message);
        },
      });
      this.check(id);
      this.diff = diff;
      await this.show(id);
    } catch (err) {
      if (this.status?.id === id) this.update('error', (err as Error).message);
    }
  }

  private snapshotUri(id: string, filePath: string, side: 'before' | 'after') {
    return vscode.Uri.from({ scheme: this.scheme, path: '/' + filePath, query: id + '/' + side });
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    if (!this.diff || !this.status) throw new Error('This preview has expired.');
    if (uri.toString() === this.snapshotUri(this.status.id, this.diff.filePath, 'before').toString()) return this.diff.oldCode;
    if (uri.toString() === this.snapshotUri(this.status.id, this.diff.filePath, 'after').toString()) return this.diff.newCode;
    throw new Error('This preview has expired.');
  }

  async show(id: string) {
    if (this.status?.id !== id || !this.diff || this.status.phase === 'applying') return;
    try {
      this.check(id);
      await vscode.commands.executeCommand('vscode.diff', this.snapshotUri(this.status.id, this.diff.filePath, 'before'),
        this.snapshotUri(this.status.id, this.diff.filePath, 'after'), this.status.ticketKey + ' • ' + this.diff.filePath,
        { preview: true, preserveFocus: true });
      this.check(id);
      this.update('review', 'Review the proposed change to ' + this.diff.filePath + '.');
    } catch (err) {
      if (this.status?.id === id) this.update('error', (err as Error).message);
    }
  }

  discard(id: string) {
    if (this.status?.id !== id || this.status.phase === 'applying') return;
    this.update('done', 'Preview discarded.');
    this.reset();
  }

  async apply(id: string) {
    if (this.status?.id !== id || this.status.phase !== 'review' || !this.root || !this.diff) return;
    this.update('applying', 'Applying reviewed change…');
    try {
      this.check(id);
      const diff = this.diff;
      const doc = await readTarget(this.root, diff.filePath);
      const editor = await vscode.window.showTextDocument(doc, { preview: false });
      this.check(id);
      if (doc.isDirty || doc.getText() !== diff.oldCode) {
        throw new Error('The file changed after preview. Generate a fresh preview.');
      }
      const range = new vscode.Range(doc.positionAt(0), doc.positionAt(diff.oldCode.length));
      const applied = await editor.edit(edit => edit.replace(range, diff.newCode));
      if (!applied) throw new Error('The editor changed. Generate a fresh preview.');
      if (this.status?.id === id) {
        this.diff = undefined;
        this.update('done', 'Applied to ' + diff.filePath + '. Save the editor to keep it, or use Undo.');
      }
    } catch (err) {
      if (this.status?.id === id) this.update('error', (err as Error).message);
    }
  }
}
