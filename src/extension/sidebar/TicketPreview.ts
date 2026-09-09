import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { OpenAIClient } from '../clients/OpenAIClient';
import { CodeAnalyzer } from '../engine/CodeAnalyzer';
import { AgentSession, fixFailingTests, proposeTicketChange, reviseTicketChange, TicketEdit, TicketProposal } from '../engine/TicketAgent';
import { runProjectTests } from '../engine/projectTests';
import {
  commitOnBranch, defaultBranch, DescriptionInput, describe, draftText, FetchLike, git, inspectRepository,
  openDraftPullRequest, RepositoryState,
} from '../engine/pullRequest';
import type { ChatMessage } from '../clients/OpenAIClient';
import { walkWorkspace } from '../utils/fileWalker';
import { AgentStep, ProjectTestResult, ProposalFile, PullRequestState, TicketAgentStatus, TicketData } from '../types';
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

const MAX_STEPS = 200;

/** Services the draft PR flow needs; tests replace them. */
export interface PullRequestDeps {
  chat?: (messages: ChatMessage[], format: 'json') => Promise<string>;
  getGitHubToken: () => Promise<string>;
  push: (root: string, branch: string) => Promise<void>;
  fetch: FetchLike;
  openExternal: (url: string) => void;
}

interface GitRepositoryApi {
  push(remote?: string, name?: string, setUpstream?: boolean): Promise<void>;
}

/** Push through VS Code's Git extension so the developer's existing sign-in is used. */
async function pushBranch(root: string, branch: string) {
  let repository: GitRepositoryApi | null | undefined;
  try {
    const extension = vscode.extensions.getExtension<{ getAPI(version: 1): { getRepository(uri: vscode.Uri): GitRepositoryApi | null } }>('vscode.git');
    const exports = extension && (extension.isActive ? extension.exports : await extension.activate());
    repository = exports?.getAPI(1).getRepository(vscode.Uri.file(root));
  } catch {
    repository = undefined;
  }
  if (repository) await repository.push('origin', branch, true);
  else await git(root, ['push', '-u', 'origin', branch]);
}

const defaultPullRequestDeps: PullRequestDeps = {
  async getGitHubToken() {
    const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
    return session.accessToken;
  },
  push: pushBranch,
  fetch: (url, init) => fetch(url, init),
  openExternal: url => { void vscode.env.openExternal(vscode.Uri.parse(url)); },
};
/** Repairs that start on their own after failing tests; the developer can ask for more. */
export const AUTO_REPAIRS = 3;

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
  private session?: AgentSession;
  /** Bumped on each revision so open diff tabs never show a stale snapshot. */
  private revision = 0;
  /** Set while a revision or repair runs; cancelling restores the state it started from. */
  private revisionRun?: { cancelled: boolean; kind: 'change' | 'repair'; restore: () => void };
  /** Every file written by Apply for this ticket, across repair attempts. */
  private applied = new Map<string, ProposalFile>();
  private repairs = 0;
  private ticket?: TicketData;
  /** Git progress for the draft PR, so a retry after a failed push doesn't commit twice. */
  private prRun?: { state: RepositoryState; summary: string; committed: boolean; pushed: boolean };
  private readonly prDeps: PullRequestDeps;

  constructor(
    private readonly client: Pick<OpenAIClient, 'agentTurn'>,
    private readonly analyzer: Pick<CodeAnalyzer, 'indexWorkspace' | 'search'>,
    private readonly notify: (status: TicketAgentStatus) => void,
    readonly scheme = 'ticket-to-code-preview',
    prDeps: Partial<PullRequestDeps> = {}
  ) {
    this.prDeps = { ...defaultPullRequestDeps, ...prDeps };
  }

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
    this.session = undefined;
    this.applied.clear();
    this.repairs = 0;
    this.ticket = undefined;
    this.prRun = undefined;
    if (this.revisionRun) this.revisionRun.cancelled = true;
    this.revisionRun = undefined;
  }

  private update(phase: TicketAgentStatus['phase'], message: string, testResult?: ProjectTestResult) {
    if (!this.status) return;
    this.status = { ...this.status, phase, message, testResult };
    this.notify(this.status);
  }

  private addStep(step: AgentStep) {
    if (!this.status) return;
    const steps = [...(this.status.steps ?? []), step].slice(-MAX_STEPS);
    this.status = { ...this.status, steps };
    this.notify(this.status);
  }

  private workspace(id: string, root: string, run?: { cancelled: boolean }) {
    const paths = walkWorkspace(root).map(file => file.relativePath);
    const checkActive = () => {
      this.check(id);
      if (run?.cancelled) throw new Error('Revision stopped.');
    };
    return {
      checkActive,
      search: (query: string) => this.analyzer.search(query, 5, root),
      list: (query: string) => paths.filter(p => p.toLowerCase().includes(query.toLowerCase())).slice(0, 100),
      checkNewFile: async (file: string) => { await newTestUri(root, file); },
      read: async (file: string) => (await readTarget(root, file)).getText(),
      progress: (message: string) => {
        checkActive();
        this.update('running', message);
      },
      step: (step: AgentStep) => {
        checkActive();
        this.addStep(step);
      },
    };
  }

  /** Show a finished proposal: review its files, or report that nothing needs to change. */
  private async present(id: string, proposal: TicketProposal) {
    this.check(id);
    this.session = proposal.session;
    this.references = proposal.references;
    this.edits = proposal.edits;
    this.revision++;
    this.status = { ...this.status!, existingTest: proposal.existingTest, coverage: proposal.coverage, canRevise: true, revising: undefined,
      canFix: false,
      files: proposal.edits.map(({ filePath, isNew, purpose }) => ({ filePath, isNew, purpose })) };
    if (!proposal.edits.length) {
      this.update('done', 'No changes proposed. ' + proposal.coverage);
      return;
    }
    this.update('review', 'Review the files below before applying.');
    await this.show(id, (this.edits.find(edit => edit.purpose === 'fix') ?? this.edits[0]).filePath);
  }

  private check(id: string) {
    if (this.status?.id !== id || this.root !== getWorkspaceRoot()) {
      throw new Error('The active ticket or workspace has changed.');
    }
  }

  async start(ticket: TicketData) {
    if (this.status?.phase === 'applying' || this.status?.phase === 'running' || this.testRun) return;
    this.reset();
    this.ticket = ticket;
    const id = randomUUID();
    const root = getWorkspaceRoot();
    this.root = root;
    this.status = { id, ticketKey: ticket.key, phase: 'running', message: '', steps: [] };
    this.update('running', 'Indexing the workspace…');
    try {
      if (!root) throw new Error('Open a workspace folder first.');
      await this.analyzer.indexWorkspace(root);
      this.check(id);
      this.addStep({ kind: 'index', label: 'Indexed the workspace', ok: true });
      const proposal = await proposeTicketChange(this.client, ticket, this.workspace(id, root));
      await this.present(id, proposal);
    } catch (err) {
      if (this.status?.id === id) this.update('error', (err as Error).message);
    }
  }

  /**
   * Ask the agent to change its finished proposal. On failure the previous proposal stays
   * in place, so the developer can still apply, discard or try another instruction.
   */
  async revise(id: string, instruction: string) {
    const status = this.status;
    const session = this.session;
    if (status?.id !== id || !session || !this.root || this.testRun || this.revisionRun ||
        (status.phase !== 'review' && status.phase !== 'done') || typeof instruction !== 'string') return;
    this.addStep({ kind: 'request', label: 'You asked: ' + instruction.trim().slice(0, 300), ok: true });
    await this.continueProposal(id, 'change', 'Revising the proposal…',
      workspace => reviseTicketChange(this.client, session, instruction, workspace));
  }

  /**
   * Ask the agent to repair applied changes whose tests failed. The repair is a new proposal on top
   * of the saved files, so it goes through review and Apply like the first one.
   */
  async fixTests(id: string, instruction: string, automatic = false) {
    const status = this.status;
    const session = this.session;
    const root = this.root;
    if (status?.id !== id || !session || !root || this.testRun || this.revisionRun || status.phase !== 'applied' ||
        status.testResult?.outcome !== 'failed' || this.prBusy() || typeof instruction !== 'string') return;
    const failure = status.testResult;
    const attempt = this.repairs + 1;
    const of = attempt <= AUTO_REPAIRS ? ` of ${AUTO_REPAIRS}` : '';
    this.addStep({ kind: 'repair', ok: true, label: automatic
      ? `Tests failed, so the agent is fixing them (attempt ${attempt}${of})`
      : `Asked the agent to fix the failing tests (attempt ${attempt}${of})` });
    if (instruction.trim()) this.addStep({ kind: 'request', label: 'You asked: ' + instruction.trim().slice(0, 300), ok: true });
    await this.continueProposal(id, 'repair', `Fixing the failing tests (attempt ${attempt}${of})…`, async workspace => {
      // The saved files are the new baseline; an unsaved edit would make the next diff misleading.
      const current = new Map<string, string>();
      for (const filePath of this.applied.keys()) current.set(filePath, (await readTarget(root, filePath)).getText());
      this.repairs = attempt;
      this.status = { ...this.status!, repair: { attempt, max: AUTO_REPAIRS } };
      return fixFailingTests(this.client, session, current,
        { command: failure.command, output: failure.output, attempt, maxAttempts: AUTO_REPAIRS }, instruction, workspace);
    });
  }

  /** Run the agent again from a finished session; on failure or Cancel, return to where it started. */
  private async continueProposal(
    id: string, kind: 'change' | 'repair', message: string,
    work: (workspace: ReturnType<TicketPreview['workspace']>) => Promise<TicketProposal>
  ) {
    const status = this.status!;
    const previous = { phase: status.phase, message: status.message, testResult: status.testResult };
    const run = {
      cancelled: false,
      kind,
      restore: () => {
        this.status = { ...this.status!, revising: undefined };
        this.update(previous.phase, previous.message, previous.testResult);
      },
    };
    this.revisionRun = run;
    this.status = { ...status, revising: kind };
    this.update('running', message);
    try {
      this.check(id);
      const proposal = await work(this.workspace(id, this.root!, run));
      if (run.cancelled) return;
      await this.present(id, proposal);
    } catch (err) {
      if (this.status?.id !== id || run.cancelled) return;
      this.addStep({ kind: 'request', ok: false, detail: (err as Error).message.slice(0, 300),
        label: kind === 'repair' ? 'Couldn’t fix the failing tests' : 'Couldn’t revise the proposal' });
      run.restore();
    } finally {
      if (this.revisionRun === run) this.revisionRun = undefined;
    }
  }

  /** Address of one side of the current proposal's diff for a file. */
  snapshotUri(id: string, filePath: string, side: 'before' | 'after') {
    return vscode.Uri.from({ scheme: this.scheme, path: '/' + filePath, query: id + '/' + this.revision + '/' + side });
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
    if (this.revisionRun) {
      // Stop only the revision; the proposal it started from stays reviewable.
      const run = this.revisionRun;
      run.cancelled = true;
      this.revisionRun = undefined;
      this.addStep({ kind: 'request', label: run.kind === 'repair' ? 'Stopped the repair' : 'Stopped the revision', ok: false });
      run.restore();
      return;
    }
    this.status = { ...this.status, canRevise: false, canFix: false, revising: undefined };
    this.update('done', 'Preview discarded.');
    this.reset();
  }

  stopTests(id: string) {
    if (this.status?.id === id) this.testRun?.abort();
  }

  /** Run the project tests on the saved files. After an Apply, a failure starts a repair on its own. */
  async runTests(id: string, afterApply = false) {
    if (this.status?.id !== id || this.status.phase !== 'applied' || !this.root || this.testRun || this.prBusy()) return;
    const controller = new AbortController();
    this.testRun = controller;
    this.update('testing', 'Checking the saved files…');
    try {
      this.check(id);
      if (!vscode.workspace.isTrusted) throw new Error('Trust this workspace in VS Code to run its tests.');
      const root = this.root;
      const files = [...this.applied.keys()];
      const documents = await Promise.all(files.map(async file =>
        vscode.workspace.openTextDocument(await existingFile(root, file))));
      const dirty = documents.findIndex(doc => doc.isDirty);
      if (dirty !== -1) throw new Error('Save ' + files[dirty] + ' (File → Save All) and click Run tests again.');
      this.check(id);
      const result = await runProjectTests(root, controller.signal, command => {
        this.check(id);
        this.update('testing', 'Running ' + command + '…');
      });
      if (this.status?.id === id) {
        const label = result.command ? 'Ran ' + result.command : 'Looked for a test command';
        this.addStep({ kind: 'test', label, detail: result.outcome, ok: result.outcome === 'passed' });
        this.update('applied', result.summary, result);
        if (result.outcome === 'failed' && afterApply && this.repairs < AUTO_REPAIRS) {
          if (this.testRun === controller) this.testRun = undefined;
          await this.fixTests(id, '', true);
        }
      }
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
      for (const change of this.edits) {
        if (!this.applied.has(change.filePath)) {
          this.applied.set(change.filePath, { filePath: change.filePath, purpose: change.purpose, isNew: change.isNew });
        }
      }
      // The developer approved these exact contents, so save them for the test run.
      for (const { doc, change } of existing) {
        if (!await doc.save()) throw new Error('Applied the changes, but VS Code could not save ' + change.filePath + '. Save it, then Run tests.');
      }
      if (this.status?.id !== id) return;
      this.status = { ...this.status, canRevise: false, canFix: true, files: [...this.applied.values()] };
      if (!vscode.workspace.isTrusted) {
        this.update('applied', 'Applied and saved the reviewed files. Trust this workspace in VS Code to run its tests.');
        return;
      }
      this.update('applied', 'Applied and saved the reviewed files.');
      await this.runTests(id, true);
    } catch (err) {
      if (this.status?.id === id) this.update('error', (err as Error).message);
    }
  }

  // ─── Draft pull request ──────────────────────────────────────────────

  private prBusy() {
    const phase = this.status?.pr?.phase;
    return phase === 'drafting' || phase === 'creating';
  }

  private setPr(pr: PullRequestState | undefined) {
    if (!this.status) return;
    this.status = { ...this.status, pr };
    this.notify(this.status);
  }

  private descriptionInput(): DescriptionInput {
    return {
      ticket: this.ticket!,
      files: [...this.applied.values()],
      coverage: this.status?.coverage,
      testResult: this.status?.testResult,
      repairs: this.repairs,
    };
  }

  /** Write a PR title and description for the applied files and show them for confirmation. */
  async draftPR(id: string) {
    const status = this.status;
    const pr = status?.pr;
    if (status?.id !== id || status.phase !== 'applied' || !this.root || !this.ticket || !this.applied.size ||
        this.testRun || this.revisionRun || (pr && !(pr.phase === 'ready' && !pr.draft))) return;
    const root = this.root;
    const ticket = this.ticket;
    this.setPr({ phase: 'drafting' });
    try {
      const files = [...this.applied.keys()];
      const state = this.prRun?.committed ? this.prRun.state : await inspectRepository(root, files, ticket.key, ticket.summary);
      this.check(id);
      const input = this.descriptionInput();
      const text = await draftText(this.prDeps.chat, input, state.diff);
      this.check(id);
      this.prRun = { committed: false, pushed: false, ...this.prRun, state, summary: text.summary };
      this.setPr({ phase: 'ready', draft: {
        title: text.title, body: describe(input, text.summary), branch: state.branch,
        base: state.currentOnRemote ? state.current : 'the default branch', repo: `${state.repo.owner}/${state.repo.repo}`,
      } });
    } catch (err) {
      if (this.status?.id === id) this.setPr({ phase: 'ready', error: (err as Error).message });
    }
  }

  /** Commit the applied files on the ticket branch, push it and open the draft PR. */
  async createPR(id: string, title: string, body: string) {
    const status = this.status;
    const pr = status?.pr;
    const run = this.prRun;
    if (status?.id !== id || status.phase !== 'applied' || pr?.phase !== 'ready' || !pr.draft || !run || !this.root ||
        typeof title !== 'string' || typeof body !== 'string') return;
    const draft = { ...pr.draft, title: title.replace(/\s+/g, ' ').trim(), body };
    if (!draft.title || draft.title.length > 256 || body.length > 60000) {
      this.setPr({ ...pr, error: 'Give the PR a title under 256 characters and a description under 60,000.' });
      return;
    }
    const root = this.root;
    const { state } = run;
    const files = [...this.applied.keys()];
    this.setPr({ phase: 'creating', draft });
    try {
      if (!run.committed) {
        for (const file of files) {
          const doc = await vscode.workspace.openTextDocument(await existingFile(root, file));
          if (doc.isDirty) throw new Error(`Save ${file} first so the PR matches your editor.`);
        }
        this.check(id);
        await commitOnBranch(root, state, files, draft.title, run.summary);
        run.committed = true;
        this.addStep({ kind: 'git', ok: true, label: `Committed ${files.length} file${files.length === 1 ? '' : 's'} on ${state.branch}` });
      }
      if (!run.pushed) {
        await this.prDeps.push(root, state.branch);
        run.pushed = true;
        this.addStep({ kind: 'git', ok: true, label: `Pushed ${state.branch} to origin` });
      }
      const token = await this.prDeps.getGitHubToken();
      const base = state.currentOnRemote ? state.current : await defaultBranch(this.prDeps.fetch, token, state.repo);
      const opened = await openDraftPullRequest(this.prDeps.fetch, token, state.repo,
        { head: state.branch, base, title: draft.title, body: draft.body });
      if (this.status?.id !== id) return;
      this.addStep({ kind: 'git', ok: true, label: `Opened draft PR #${opened.number}`, detail: `into ${base}` });
      this.setPr({ phase: 'created', draft: { ...draft, base }, number: opened.number, url: opened.url });
    } catch (err) {
      if (this.status?.id !== id) return;
      const message = (err as Error).message;
      this.addStep({ kind: 'git', ok: false, label: 'Couldn’t open the draft PR', detail: message.slice(0, 300) });
      const resume = run.committed && !run.pushed
        ? ` The commit is on ${state.branch}; trying again will push it.`
        : run.pushed ? ` ${state.branch} is pushed; trying again will only open the PR.` : '';
      this.setPr({ phase: 'ready', draft, error: message + resume });
    }
  }

  cancelPR(id: string) {
    if (this.status?.id !== id || this.status.pr?.phase !== 'ready') return;
    if (this.prRun && !this.prRun.committed) this.prRun = undefined;
    this.setPr(undefined);
  }

  openPR(id: string) {
    const pr = this.status?.pr;
    if (this.status?.id === id && pr?.phase === 'created' && pr.url) this.prDeps.openExternal(pr.url);
  }
}
