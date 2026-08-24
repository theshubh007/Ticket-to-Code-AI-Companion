import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { OpenAIClient } from '../clients/OpenAIClient';
import { CodeAnalyzer } from '../engine/CodeAnalyzer';
import { proposeTicketChange, TicketEdit } from '../engine/TicketAgent';
import { runProjectTests } from '../engine/projectTests';
import { walkWorkspace } from '../utils/fileWalker';
import { ProjectTestResult, TicketAgentStatus, TicketData } from '../types';
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

// Check every existing ancestor, including dangling links, before preview and again before apply.
async function newTestUri(root: string, relative: string): Promise<vscode.Uri> {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || /[\\:\x00-\x1f]/.test(relative) ||
      relative.split('/').some(part => !part || part.startsWith('.') || part === 'node_modules' || part === 'vendor')) {
    throw new Error('Choose a relative test path inside the workspace.');
  }
  let current = await fs.realpath(root);
  const parts = relative.split('/');
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    try {
      const stat = await fs.lstat(current);
      if (index === parts.length - 1) throw new Error(relative + ' already exists. Read it before proposing an edit.');
      if (!stat.isDirectory()) throw new Error('Test path contains a non-directory or symbolic link.');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') break;
      throw err;
    }
  }
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
  private edits: TicketEdit[] = [];
  private references = new Map<string, string>();
  private root?: string;
  private testRun?: AbortController;

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
    this.testRun?.abort();
    this.testRun = undefined;
    this.status = undefined;
    this.edits = [];
    this.references.clear();
    this.root = undefined;
  }

  private update(phase: TicketAgentStatus['phase'], message: string, testResult?: ProjectTestResult) {
    if (!this.status) return;
    this.status = { ...this.status, phase, message, testResult };
    this.notify(this.status);
  }

  private check(id: string) {
    if (this.status?.id !== id || this.root !== getWorkspaceRoot()) {
      throw new Error('The active ticket or workspace has changed.');
    }
  }

  async start(ticket: TicketData) {
    if (this.status?.phase === 'applying' || this.status?.phase === 'running' || this.testRun) return;
    this.reset();
    const id = randomUUID();
    const root = getWorkspaceRoot();
    this.root = root;
    this.status = { id, ticketKey: ticket.key, phase: 'running', message: '' };
    this.update('running', 'Indexing the workspace…');
    try {
      if (!root) throw new Error('Open a workspace folder first.');
      await this.analyzer.indexWorkspace(root);
      this.check(id);
      const paths = walkWorkspace(root).map(file => file.relativePath);
      const proposal = await proposeTicketChange(this.client, ticket, {
        checkActive: () => this.check(id),
        search: query => this.analyzer.search(query, 5, root),
        list: query => paths.filter(p => p.toLowerCase().includes(query.toLowerCase())).slice(0, 100),
        checkNewFile: async file => { await newTestUri(root, file); },
        read: async file => (await readTarget(root, file)).getText(),
        progress: message => {
          this.check(id);
          this.update('running', message);
        },
      });
      this.check(id);
      this.references = proposal.references;
      this.status = { ...this.status, existingTest: proposal.existingTest, coverage: proposal.coverage,
        files: proposal.edits.map(({ filePath, isNew, purpose }) => ({ filePath, isNew, purpose })) };
      if (!proposal.edits.length) {
        this.update('done', 'No changes proposed. ' + proposal.coverage);
        return;
      }
      this.edits = proposal.edits;
      this.update('review', 'Review the files below before applying.');
      await this.show(id, (this.edits.find(edit => edit.purpose === 'fix') ?? this.edits[0]).filePath);
    } catch (err) {
      if (this.status?.id === id) this.update('error', (err as Error).message);
    }
  }

  private snapshotUri(id: string, filePath: string, side: 'before' | 'after') {
    return vscode.Uri.from({ scheme: this.scheme, path: '/' + filePath, query: id + '/' + side });
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    if (this.status) {
      for (const edit of this.edits) {
        if (uri.toString() === this.snapshotUri(this.status.id, edit.filePath, 'before').toString()) return edit.oldCode;
        if (uri.toString() === this.snapshotUri(this.status.id, edit.filePath, 'after').toString()) return edit.newCode;
      }
    }
    throw new Error('This preview has expired.');
  }

  async show(id: string, filePath: string) {
    if (this.status?.id !== id || this.status.phase !== 'review' || !this.edits.some(file => file.filePath === filePath)) return;
    try {
      this.check(id);
      await vscode.commands.executeCommand('vscode.diff', this.snapshotUri(id, filePath, 'before'),
        this.snapshotUri(id, filePath, 'after'), this.status.ticketKey + ' • ' + filePath,
        { preview: true, preserveFocus: true });
    } catch (err) {
      if (this.status?.id === id) this.update('error', (err as Error).message);
    }
  }

  discard(id: string) {
    if (this.status?.id !== id || this.status.phase === 'applying') return;
    this.update('done', 'Preview discarded.');
    this.reset();
  }

  stopTests(id: string) {
    if (this.status?.id === id) this.testRun?.abort();
  }

  async runTests(id: string) {
    if (this.status?.id !== id || this.status.phase !== 'applied' || !this.root) return;
    const controller = new AbortController();
    this.testRun = controller;
    this.update('testing', 'Checking the saved files…');
    try {
      this.check(id);
      if (!vscode.workspace.isTrusted) throw new Error('Trust this workspace in VS Code to run its tests.');
      const root = this.root;
      const documents = await Promise.all(this.edits.map(async edit =>
        vscode.workspace.openTextDocument(await existingFile(root, edit.filePath))));
      const dirty = documents.findIndex(doc => doc.isDirty);
      if (dirty !== -1) throw new Error('Save ' + this.edits[dirty].filePath + ' (File → Save All) and click Run tests again.');
      this.check(id);
      const result = await runProjectTests(root, controller.signal, command => {
        this.check(id);
        this.update('testing', 'Running ' + command + '…');
      });
      if (this.status?.id === id) this.update('applied', result.summary, result);
    } catch (err) {
      if (this.status?.id === id) {
        this.update('applied', controller.signal.aborted ? 'Test run stopped.' : (err as Error).message);
      }
    } finally {
      if (this.testRun === controller) this.testRun = undefined;
    }
  }

  async apply(id: string) {
    if (this.status?.id !== id || this.status.phase !== 'review' || !this.root) return;
    this.update('applying', 'Applying reviewed files…');
    try {
      const root = this.root;
      for (const [filePath, reviewed] of this.references) {
        const doc = await readTarget(root, filePath);
        if (doc.getText() !== reviewed) throw new Error(filePath + ' changed after preview. Generate a fresh proposal.');
      }
      const edit = new vscode.WorkspaceEdit();
      const existing: { doc: vscode.TextDocument; change: TicketEdit }[] = [];
      for (const change of this.edits) {
        this.check(id);
        if (change.isNew) {
          const uri = await newTestUri(root, change.filePath);
          edit.createFile(uri, { overwrite: false, contents: Buffer.from(change.newCode, 'utf8') });
        } else {
          existing.push({ doc: await readTarget(root, change.filePath), change });
        }
      }
      // Keep text replacements together and verify every buffer after the last async read.
      for (const { doc, change } of existing) {
        if (doc.isDirty || doc.getText() !== change.oldCode) {
          throw new Error(change.filePath + ' changed after preview. Generate a fresh proposal.');
        }
        edit.replace(doc.uri, new vscode.Range(doc.positionAt(0), doc.positionAt(change.oldCode.length)), change.newCode);
      }
      this.check(id);
      if (!await vscode.workspace.applyEdit(edit)) {
        throw new Error('VS Code could not finish applying the proposal. Review the workspace changes before retrying.');
      }
      // Keep every dirty buffer in the editor group so File → Save All includes it.
      for (const { doc } of existing) {
        if (this.status?.id !== id) return;
        await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
      }
      if (this.status?.id === id) this.update('applied', 'Applied the reviewed files. Use File → Save All, then Run tests.');
    } catch (err) {
      if (this.status?.id === id) this.update('error', (err as Error).message);
    }
  }
}
