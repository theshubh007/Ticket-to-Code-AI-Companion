import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { AssistantTurn, AgentMessage } from '../../clients/OpenAIClient';
import { CodeAnalyzer } from '../../engine/CodeAnalyzer';
import { CacheManager } from '../../engine/CacheManager';
import { OpenAIClient } from '../../clients/OpenAIClient';
import { AUTO_REPAIRS, TicketPreview } from '../../sidebar/TicketPreview';
import { runProjectTests } from '../../engine/projectTests';
import { git } from '../../engine/pullRequest';

jest.mock('../../engine/projectTests', () => ({ runProjectTests: jest.fn() }));
import { TicketAgentStatus, TicketData } from '../../types';

const ticket: TicketData = { key: 'DEMO-1', summary: 'Explain an empty list', description: '',
  acceptanceCriteria: 'Display an empty state', labels: [], priority: '', status: '', issueType: '' };
const original = 'return items;\r\n';
const proposed = "return items.length ? items : 'No items';\r\n";
const target = 'list.ts';
const testPath = 'tests/list.test.ts';
const assertion = "expect(render([])).toBe('No items')";
const regression = `it('explains an empty list', () => ${assertion});\n`;
type AssistantTurnLike = { tool_calls?: { id: string }[] };

function call(name: string, args: Record<string, string>): AssistantTurn {
  return { role: 'assistant', content: null, tool_calls: [
    { type: 'function', id: name, function: { name, arguments: JSON.stringify(args) } },
  ] };
}

describe('ticket preview', () => {
  let root: string;
  let text: string;
  let statuses: TicketAgentStatus[];
  let agentTurn: jest.Mock;
  let preview: TicketPreview;
  let snapshots: string[];

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'ticket-agent-'));
    await fs.writeFile(path.join(root, target), original);
    text = original;
    statuses = [];
    snapshots = [];
    const doc = { uri: vscode.Uri.file(path.join(root, target)), getText: () => text, positionAt: (offset: number) => offset, isDirty: false,
      save: jest.fn(async () => { await fs.writeFile(path.join(root, target), text); return true; }) };
    Object.assign(vscode.workspace, {
      workspaceFolders: [{ uri: { fsPath: root } }],
      openTextDocument: async (uri: vscode.Uri) => uri.fsPath === doc.uri.fsPath ? doc : {
        ...doc, uri, getText: () => require('fs').readFileSync(uri.fsPath, 'utf8'),
      },
      applyEdit: jest.fn(async (edit: { replacement: string }) => { text = edit.replacement; return true; }),
    });
    Object.assign(vscode.window, { showTextDocument: jest.fn() });
    Object.assign(vscode.Uri, { from: (parts: object) => ({ toString: () => JSON.stringify(parts) }) });
    Object.assign(vscode.commands, { executeCommand: async (name: string, before: vscode.Uri, after: vscode.Uri) => {
      expect(name).toBe('vscode.diff');
      snapshots = [before, after].map(uri => preview.provideTextDocumentContent(uri));
    } });
    agentTurn = jest.fn(async (messages: AgentMessage[]) => {
      const previous = messages[messages.length - 1];
      if (previous.role === 'user') return call('search_code', { query: 'list render' });
      if (previous.role !== 'tool') throw new Error('Missing tool response');
      if (previous.tool_call_id === 'search_code') {
        const hits = JSON.parse(previous.content);
        return call('read_file', { filePath: hits[0].filePath });
      }
      if (previous.tool_call_id === 'read_file') {
        const file = JSON.parse(previous.content);
        return call('propose_edit', { filePath: file.filePath, before: file.content, after: proposed, purpose: 'fix' });
      }
      if (previous.tool_call_id === 'propose_edit') return call('list_files', { query: 'test' });
      if (previous.tool_call_id === 'list_files') return call('propose_test_file', { filePath: testPath, content: regression });
      return call('finish_proposal', { implementationPath: target, testFilePath: testPath, assertion, coverage: 'Covers empty lists.' });
    });
    preview = new TicketPreview({ agentTurn }, {
      indexWorkspace: jest.fn(), search: async () => [{ filePath: target, content: original, startLine: 0, endLine: 0 }],
    }, status => statuses.push(status));
  });

  afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

  it('opens both snapshots and edits the document only on explicit Apply', async () => {
    await preview.start(ticket);
    const review = statuses[statuses.length - 1];
    expect(review).toMatchObject({ phase: 'review', files: [
      { filePath: target, purpose: 'fix', isNew: false }, { filePath: testPath, purpose: 'test', isNew: true },
    ] });
    expect(snapshots).toEqual([original, proposed]);
    await preview.show(review.id, testPath);
    expect(snapshots).toEqual(['', regression]);
    await expect(fs.stat(path.join(root, testPath))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(vscode.workspace.applyEdit).not.toHaveBeenCalled();
    expect(text).toBe(original);
    await preview.apply('unrelated-preview');
    expect(text).toBe(original);
    await preview.apply(review.id);
    expect(text).toBe(proposed);
    // Apply saves exactly what was reviewed.
    expect(await fs.readFile(path.join(root, target), 'utf8')).toBe(proposed);
  });

  it('uses the active workspace when cached paths and timestamps match another project', async () => {
    const otherRoot = path.join(root, '.other-project');
    await fs.mkdir(otherRoot);
    const otherFile = path.join(otherRoot, target);
    await fs.writeFile(otherFile, 'other workspace');
    const timestamp = new Date('2025-01-01');
    await fs.utimes(path.join(root, target), timestamp, timestamp);
    await fs.utimes(otherFile, timestamp, timestamp);
    const embeddings = new OpenAIClient({ apiKey: '' });
    jest.spyOn(embeddings, 'embed').mockImplementation(async texts => texts.map(() => [1]));
    const analyzer = new CodeAnalyzer(embeddings, new CacheManager(path.join(root, '.cache')));
    await analyzer.indexWorkspace(root);
    await analyzer.indexWorkspace(otherRoot);
    const hits = await analyzer.search('list', 1, otherRoot);
    expect(hits[0].content).toBe('other workspace');
    await expect(analyzer.search('list', 1, root)).rejects.toThrow('not indexed');
  });

  it('discard expires the proposal', async () => {
    await preview.start(ticket);
    expect(statuses[statuses.length - 1].phase).toBe('review');
    const id = statuses[statuses.length - 1].id;
    preview.discard(id);
    await preview.apply(id);
    expect(text).toBe(original);
  });

  it('refuses a stale preview if the file changes outside the editor', async () => {
    await preview.start(ticket);
    expect(statuses[statuses.length - 1].phase).toBe('review');
    const id = statuses[statuses.length - 1].id;
    await fs.writeFile(path.join(root, target), 'another edit');
    await preview.apply(id);
    expect(statuses[statuses.length - 1].phase).toBe('error');
    expect(text).toBe(original);
    expect(await fs.readFile(path.join(root, target), 'utf8')).toBe('another edit');
  });

  it('preserves a new test path that someone created after preview', async () => {
    await preview.start(ticket);
    const review = statuses[statuses.length - 1];
    await fs.mkdir(path.join(root, 'tests'));
    await fs.writeFile(path.join(root, testPath), 'my test');
    await preview.apply(review.id);
    expect(statuses[statuses.length - 1]).toMatchObject({ phase: 'error' });
    expect(vscode.workspace.applyEdit).not.toHaveBeenCalled();
    expect(await fs.readFile(path.join(root, testPath), 'utf8')).toBe('my test');
  });

  it('rejects a test directory replaced by a symbolic link after review', async () => {
    await preview.start(ticket);
    const review = statuses[statuses.length - 1];
    await fs.symlink(os.tmpdir(), path.join(root, 'tests'));
    await preview.apply(review.id);
    expect(statuses[statuses.length - 1].message).toMatch(/symbolic link/);
    expect(vscode.workspace.applyEdit).not.toHaveBeenCalled();
  });

  it.each([true, false])('reviews existing test coverage (extend test = %s)', async extend => {
    const existing = 'list.test.ts';
    const oldTest = extend ? "it('renders items', () => checkItems());" : regression;
    await fs.writeFile(path.join(root, existing), oldTest);
    const turns = [
      call('list_files', { query: 'list' }), call('read_file', { filePath: target }),
      call('propose_edit', { filePath: target, before: original, after: proposed, purpose: 'fix' }),
      call('read_file', { filePath: existing }),
    ];
    if (extend) turns.push(call('propose_edit', { filePath: existing, before: oldTest, after: oldTest + '\n' + regression, purpose: 'test' }));
    turns.push(call('finish_proposal', { implementationPath: target, testFilePath: existing, assertion, coverage: 'Checks the empty list.' }));
    agentTurn.mockImplementation(async () => turns.shift());
    await preview.start(ticket);
    const review = statuses[statuses.length - 1];
    expect(review.phase).toBe('review');
    expect(review.files).toHaveLength(extend ? 2 : 1);
    expect(review.coverage).toBe('Checks the empty list.');
    if (!extend) expect(review.existingTest).toMatchObject({ filePath: existing, startLine: 0 });
    if (extend) {
      await preview.show(review.id, existing);
      expect(snapshots).toEqual([oldTest, oldTest + '\n' + regression]);
    }
  });

  it('allows a tests-only proposal when the implementation is already fixed', async () => {
    text = proposed;
    await fs.writeFile(path.join(root, target), proposed);
    const turns = [
      call('list_files', { query: 'list' }), call('read_file', { filePath: target }),
      call('propose_test_file', { filePath: testPath, content: regression }),
      call('finish_proposal', { implementationPath: target, testFilePath: testPath, assertion, coverage: 'The fix exists. Adds empty-list coverage.' }),
    ];
    agentTurn.mockImplementation(async () => turns.shift());
    await preview.start(ticket);
    const review = statuses[statuses.length - 1];
    expect(review.phase).toBe('review');
    expect(review.files?.map(file => file.filePath)).toEqual([testPath]);
    expect(snapshots).toEqual(['', regression]);
  });

  it('reports each agent action as a timeline step', async () => {
    await preview.start(ticket);
    const review = statuses[statuses.length - 1];
    expect(review.steps?.map(step => step.kind)).toEqual(['index', 'search', 'read', 'edit', 'list', 'edit', 'finish']);
    expect(review.steps?.every(step => step.ok)).toBe(true);
    expect(review.steps?.[1]).toMatchObject({ label: 'Searched for “list render”', detail: '1 match' });
    expect(review.canRevise).toBe(true);
  });

  it('marks a rejected tool call as a failed step with the reason', async () => {
    const turns = [
      call('list_files', { query: 'list' }), call('read_file', { filePath: 'missing.ts' }), call('read_file', { filePath: target }),
      call('propose_edit', { filePath: target, before: original, after: proposed, purpose: 'fix' }),
      call('finish_proposal', { implementationPath: target, testFilePath: target, assertion: 'items.length', coverage: 'Inline.' }),
    ];
    agentTurn.mockImplementation(async () => turns.shift());
    await preview.start(ticket);
    const steps = statuses[statuses.length - 1].steps!;
    expect(steps[2]).toMatchObject({ kind: 'read', ok: false, detail: 'Choose a discovered workspace path.' });
    expect(steps[3]).toMatchObject({ kind: 'read', ok: true });
  });

  it('revises a proposal from the developer instruction in the same conversation', async () => {
    await preview.start(ticket);
    const review = statuses[statuses.length - 1];
    const extended = regression + "it('keeps items', () => expect(render([1])).toEqual([1]));\n";
    let seen: AgentMessage[] = [];
    const turns = [
      call('discard_edit', { filePath: target }),
      call('propose_test_file', { filePath: testPath, content: extended }),
      call('finish_proposal', { implementationPath: target, testFilePath: testPath, assertion, coverage: 'Tests only, as asked.' }),
    ];
    agentTurn.mockImplementation(async (messages: AgentMessage[]) => {
      seen = messages;
      return turns.shift();
    });
    await preview.revise(review.id, '  Only add tests; leave list.ts alone.  ');

    // Every earlier tool call, including finish_proposal, has its answer before the new instruction.
    const answered = new Set(seen.filter(m => m.role === 'tool').map(m => (m as { tool_call_id: string }).tool_call_id));
    for (const m of seen) {
      for (const c of (m as AssistantTurnLike).tool_calls ?? []) expect(answered.has(c.id)).toBe(true);
    }
    const request = seen.find(m => m.role === 'user' && String(m.content).includes('Only add tests; leave list.ts alone.'));
    expect(request).toBeDefined();

    const revised = statuses[statuses.length - 1];
    expect(revised).toMatchObject({ id: review.id, phase: 'review', coverage: 'Tests only, as asked.', revising: undefined });
    expect(revised.files?.map(file => file.filePath)).toEqual([testPath]);
    expect(revised.steps?.slice(-4).map(step => step.kind)).toEqual(['request', 'discard', 'edit', 'finish']);
    expect(revised.steps?.find(step => step.kind === 'request')?.label).toBe('You asked: Only add tests; leave list.ts alone.');
    expect(snapshots).toEqual(['', extended]);
    await preview.apply(review.id);
    // Only the new test file is created; list.ts gets no replacement.
    const applied = (vscode.workspace.applyEdit as jest.Mock).mock.calls[0][0];
    expect(applied.replacement).toBe('');
    expect(statuses[statuses.length - 1].phase).toBe('applied');
  });

  it('keeps the earlier proposal when a revision fails', async () => {
    await preview.start(ticket);
    const review = statuses[statuses.length - 1];
    agentTurn.mockRejectedValue(new Error('Rate limited.'));
    await preview.revise(review.id, 'Use a table-driven test');
    const after = statuses[statuses.length - 1];
    expect(after).toMatchObject({ phase: 'review', revising: undefined, files: review.files });
    expect(after.steps?.[after.steps.length - 1]).toMatchObject({ kind: 'request', ok: false, detail: 'Rate limited.' });
    expect(after.message).toBe(review.message);
    await preview.apply(review.id);
    expect(text).toBe(proposed);
  });

  it('rejects an empty instruction without calling the model', async () => {
    await preview.start(ticket);
    const review = statuses[statuses.length - 1];
    const calls = agentTurn.mock.calls.length;
    await preview.revise(review.id, '   ');
    expect(agentTurn.mock.calls.length).toBe(calls);
    expect(statuses[statuses.length - 1]).toMatchObject({ phase: 'review', files: review.files });
  });

  it('cancel during a revision stops it and keeps the earlier proposal', async () => {
    await preview.start(ticket);
    const review = statuses[statuses.length - 1];
    let release!: (turn: AssistantTurn) => void;
    agentTurn.mockImplementation(() => new Promise<AssistantTurn>(resolve => { release = resolve; }));
    const running = preview.revise(review.id, 'Rename the test');
    await new Promise(resolve => setImmediate(resolve));
    expect(statuses[statuses.length - 1]).toMatchObject({ phase: 'running', revising: 'change' });
    preview.discard(review.id);
    expect(statuses[statuses.length - 1]).toMatchObject({ phase: 'review', revising: undefined, files: review.files });
    release(call('discard_edit', { filePath: target }));
    await running;
    expect(statuses[statuses.length - 1]).toMatchObject({ phase: 'review', files: review.files });
    await preview.apply(review.id);
    expect(text).toBe(proposed);
  });

  it('cannot revise after the proposal is discarded or applied', async () => {
    await preview.start(ticket);
    const review = statuses[statuses.length - 1];
    preview.discard(review.id);
    expect(statuses[statuses.length - 1]).toMatchObject({ phase: 'done', canRevise: false });
    const calls = agentTurn.mock.calls.length;
    await preview.revise(review.id, 'Add another test');
    expect(agentTurn.mock.calls.length).toBe(calls);

    await preview.start(ticket);
    const second = statuses[statuses.length - 1];
    await preview.apply(second.id);
    expect(statuses[statuses.length - 1]).toMatchObject({ phase: 'applied', canRevise: false });
    await preview.revise(second.id, 'Add another test');
    expect(statuses[statuses.length - 1].phase).toBe('applied');
  });

  describe('after Apply', () => {
    const failed = { command: 'npm test', outcome: 'failed' as const, summary: '1 of 2 tests failed.', output: 'not ok 1 - explains an empty list' };
    const passed = { command: 'npm test', outcome: 'passed' as const, summary: '2 tests passed.', output: 'ok' };
    const repaired = "return items.length ? items : 'No items found';\r\n";
    let results: object[];

    beforeEach(() => {
      Object.assign(vscode.workspace, { isTrusted: true });
      results = [];
      (runProjectTests as jest.Mock).mockReset().mockImplementation(async () => results.shift() ?? passed);
      // The shared mock ignores created files; write them so the test run can find them.
      type Edit = { replacement: string; created?: [vscode.Uri, Uint8Array][] };
      jest.spyOn(vscode.WorkspaceEdit.prototype, 'createFile').mockImplementation(function (this: Edit, uri, options) {
        (this.created ??= []).push([uri, options?.contents as Uint8Array]);
      });
      (vscode.workspace.applyEdit as jest.Mock).mockImplementation(async (edit: Edit) => {
        if (edit.replacement) text = edit.replacement;
        for (const [uri, contents] of edit.created ?? []) {
          await fs.mkdir(path.dirname(uri.fsPath), { recursive: true });
          await fs.writeFile(uri.fsPath, contents);
        }
        return true;
      });
    });
    afterEach(() => {
      Object.assign(vscode.workspace, { isTrusted: undefined });
      jest.restoreAllMocks();
    });

    /** A repair turn: read the saved file, fix it, finish. */
    function repairTurns(after = repaired) {
      return [
        call('read_file', { filePath: target }),
        call('propose_edit', { filePath: target, before: proposed, after, purpose: 'fix' }),
        call('finish_proposal', { implementationPath: target, testFilePath: testPath, assertion, coverage: 'Fixed the message.' }),
      ];
    }

    it('saves the reviewed files and runs the tests', async () => {
      await preview.start(ticket);
      const review = statuses[statuses.length - 1];
      await preview.apply(review.id);
      expect(await fs.readFile(path.join(root, target), 'utf8')).toBe(proposed);
      expect(runProjectTests).toHaveBeenCalledTimes(1);
      const done = statuses[statuses.length - 1];
      expect(done).toMatchObject({ phase: 'applied', testResult: passed, canFix: true, files: review.files });
      expect(done.steps?.[done.steps.length - 1]).toMatchObject({ kind: 'test', ok: true, detail: 'passed' });
    });

    it('does not run tests in an untrusted workspace', async () => {
      Object.assign(vscode.workspace, { isTrusted: false });
      await preview.start(ticket);
      await preview.apply(statuses[statuses.length - 1].id);
      expect(runProjectTests).not.toHaveBeenCalled();
      expect(statuses[statuses.length - 1].message).toMatch(/Trust this workspace/);
    });

    it('repairs failing tests on its own, reviews the repair, then passes', async () => {
      results = [failed, passed];
      await preview.start(ticket);
      const review = statuses[statuses.length - 1];
      let seen: AgentMessage[] = [];
      const turns = repairTurns();
      agentTurn.mockImplementation(async (messages: AgentMessage[]) => { seen = messages; return turns.shift(); });
      await preview.apply(review.id);

      const repair = statuses[statuses.length - 1];
      expect(repair).toMatchObject({ id: review.id, phase: 'review', repair: { attempt: 1, max: AUTO_REPAIRS }, revising: undefined });
      expect(repair.files?.map(file => file.filePath)).toEqual([target]);
      // The repair diff starts from the saved, applied contents.
      expect(snapshots).toEqual([proposed, repaired]);
      const prompt = seen.find(m => m.role === 'user' && String(m.content).includes('repair attempt 1 of 3'));
      expect(String(prompt?.content)).toContain('not ok 1 - explains an empty list');
      expect(repair.steps?.some(step => step.kind === 'repair' && step.label.includes('attempt 1 of 3'))).toBe(true);

      await preview.apply(review.id);
      const done = statuses[statuses.length - 1];
      expect(done).toMatchObject({ phase: 'applied', testResult: passed, repair: { attempt: 1 } });
      expect(done.files?.map(file => file.filePath)).toEqual([target, testPath]);
      expect(await fs.readFile(path.join(root, target), 'utf8')).toBe(repaired);
    });

    it('stops repairing on its own after three attempts', async () => {
      results = [failed, failed, failed, failed];
      await preview.start(ticket);
      const id = statuses[statuses.length - 1].id;
      const fixes = [repaired, proposed.replace('No items', 'Empty'), proposed.replace('No items', 'Nothing')];
      let current = proposed;
      for (const fix of fixes) {
        const turns = repairTurns(fix).map((turn, i) => i === 1
          ? call('propose_edit', { filePath: target, before: current, after: fix, purpose: 'fix' }) : turn);
        agentTurn.mockImplementation(async () => turns.shift());
        await preview.apply(id);
        expect(statuses[statuses.length - 1].phase).toBe('review');
        current = fix;
      }
      await preview.apply(id);
      const last = statuses[statuses.length - 1];
      expect(last).toMatchObject({ phase: 'applied', testResult: failed, canFix: true, repair: { attempt: 3, max: 3 } });
      expect(runProjectTests).toHaveBeenCalledTimes(4);

      // The developer can still ask for another attempt, with a hint.
      let seen: AgentMessage[] = [];
      agentTurn.mockImplementation(async (messages: AgentMessage[]) => { seen = messages; return repairTurns(current)[0]; });
      agentTurn.mockImplementationOnce(async (messages: AgentMessage[]) => { seen = messages; throw new Error('Rate limited.'); });
      await preview.fixTests(id, 'The test expects the exact text');
      expect(String(seen[seen.length - 1].content)).toContain('The test expects the exact text');
      expect(String(seen[seen.length - 1].content)).toContain('attempt 4 of 3');
      const after = statuses[statuses.length - 1];
      expect(after).toMatchObject({ phase: 'applied', testResult: failed });
      expect(after.steps?.[after.steps.length - 1]).toMatchObject({ kind: 'request', ok: false, label: 'Couldn’t fix the failing tests' });
    });

    it('stopping a repair keeps the applied changes and the failed result', async () => {
      results = [failed];
      await preview.start(ticket);
      const id = statuses[statuses.length - 1].id;
      let release!: (turn: AssistantTurn) => void;
      let started!: () => void;
      const repairStarted = new Promise<void>(resolve => { started = resolve; });
      agentTurn.mockImplementation(() => {
        started();
        return new Promise<AssistantTurn>(resolve => { release = resolve; });
      });
      const applying = preview.apply(id);
      await repairStarted;
      expect(statuses[statuses.length - 1]).toMatchObject({ phase: 'running', revising: 'repair' });
      preview.discard(id);
      expect(statuses[statuses.length - 1]).toMatchObject({ phase: 'applied', testResult: failed, revising: undefined });
      expect(statuses[statuses.length - 1].steps?.slice(-1)[0]).toMatchObject({ label: 'Stopped the repair' });
      release(call('read_file', { filePath: target }));
      await applying;
      expect(statuses[statuses.length - 1].phase).toBe('applied');
      expect(await fs.readFile(path.join(root, target), 'utf8')).toBe(proposed);
    });

    describe('draft PR', () => {
      let bare: string;
      let requests: { url: string; method: string; body?: Record<string, unknown> }[];
      let pushes: number;
      let failPush: boolean;
      let opened: string[];

      async function previewWithGit() {
        return new TicketPreview({ agentTurn }, {
          indexWorkspace: jest.fn(), search: async () => [{ filePath: target, content: original, startLine: 0, endLine: 0 }],
        }, status => statuses.push(status), undefined, {
          chat: async () => JSON.stringify({ title: 'Explain empty lists', summary: 'Shows a message for an empty list.' }),
          getGitHubToken: async () => 'token',
          push: async (dir, branch) => {
            pushes++;
            if (failPush) { failPush = false; throw new Error('Authentication failed'); }
            await git(dir, ['push', '-q', bare, branch]);
          },
          fetch: async (url, init) => {
            requests.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
            const data = init.method === 'GET' ? { default_branch: 'main' } : { number: 7, html_url: 'https://github.com/acme/widgets/pull/7' };
            return { ok: true, status: 200, json: async () => data };
          },
          openExternal: url => opened.push(url),
        });
      }

      beforeEach(async () => {
        requests = [];
        pushes = 0;
        failPush = false;
        opened = [];
        bare = await fs.mkdtemp(path.join(os.tmpdir(), 'ticket-remote-'));
        await git(bare, ['init', '-q', '--bare']);
        await git(root, ['init', '-q', '-b', 'main']);
        await git(root, ['config', 'user.email', 'dev@example.com']);
        await git(root, ['config', 'user.name', 'Dev']);
        await git(root, ['add', target]);
        await git(root, ['commit', '-q', '-m', 'Initial']);
        await git(root, ['remote', 'add', 'origin', 'https://github.com/acme/widgets.git']);
        preview = await previewWithGit();
      });
      afterEach(async () => { await fs.rm(bare, { recursive: true, force: true }); });

      it('drafts, then commits the applied files, pushes and opens a draft PR', async () => {
        await preview.start(ticket);
        const id = statuses[statuses.length - 1].id;
        await preview.apply(id);
        await preview.draftPR(id);
        const ready = statuses[statuses.length - 1];
        expect(ready.pr).toMatchObject({ phase: 'ready', draft: {
          title: 'DEMO-1: Explain empty lists', branch: 'ticket/DEMO-1-explain-an-empty-list',
          base: 'the default branch', repo: 'acme/widgets' } });
        expect(ready.pr?.draft?.body).toContain('Shows a message for an empty list.');
        expect(ready.pr?.draft?.body).toContain('- `tests/list.test.ts` (new test)');
        expect(pushes).toBe(0);
        expect(requests).toEqual([]);

        await preview.createPR(id, 'DEMO-1: Show a message for empty lists', 'Edited body');
        const done = statuses[statuses.length - 1];
        expect(done.pr).toMatchObject({ phase: 'created', number: 7, url: 'https://github.com/acme/widgets/pull/7',
          draft: { base: 'main', title: 'DEMO-1: Show a message for empty lists' } });
        expect(requests.map(r => `${r.method} ${r.url}`)).toEqual([
          'GET https://api.github.com/repos/acme/widgets',
          'POST https://api.github.com/repos/acme/widgets/pulls',
        ]);
        expect(requests[1].body).toEqual({ head: 'ticket/DEMO-1-explain-an-empty-list', base: 'main',
          title: 'DEMO-1: Show a message for empty lists', body: 'Edited body', draft: true });
        expect((await git(root, ['branch', '--show-current'])).trim()).toBe('ticket/DEMO-1-explain-an-empty-list');
        expect((await git(root, ['log', '-1', '--format=%s'])).trim()).toBe('DEMO-1: Show a message for empty lists');
        expect((await git(root, ['show', '--name-only', '--format=', 'HEAD'])).trim().split('\n').sort()).toEqual([target, testPath].sort());
        expect((await git(bare, ['branch', '--list', 'ticket/*'])).trim()).toBe('ticket/DEMO-1-explain-an-empty-list');
        expect(done.steps?.filter(step => step.kind === 'git').map(step => step.label)).toEqual([
          'Committed 2 files on ticket/DEMO-1-explain-an-empty-list',
          'Pushed ticket/DEMO-1-explain-an-empty-list to origin',
          'Opened draft PR #7',
        ]);
        preview.openPR(id);
        expect(opened).toEqual(['https://github.com/acme/widgets/pull/7']);
      });

      it('keeps the commit when the push fails and only pushes on retry', async () => {
        failPush = true;
        await preview.start(ticket);
        const id = statuses[statuses.length - 1].id;
        await preview.apply(id);
        await preview.draftPR(id);
        await preview.createPR(id, 'DEMO-1: Explain empty lists', 'Body');
        const failed = statuses[statuses.length - 1];
        expect(failed.pr).toMatchObject({ phase: 'ready', draft: { title: 'DEMO-1: Explain empty lists' } });
        expect(failed.pr?.error).toMatch(/Authentication failed.*trying again will push it/);
        expect(requests).toEqual([]);

        await preview.createPR(id, 'DEMO-1: Explain empty lists', 'Body');
        expect(statuses[statuses.length - 1].pr).toMatchObject({ phase: 'created', number: 7 });
        expect(pushes).toBe(2);
        expect((await git(root, ['rev-list', '--count', 'main..HEAD'])).trim()).toBe('1');
      });

      it('shows why a PR cannot be drafted and lets the developer cancel', async () => {
        await git(root, ['remote', 'remove', 'origin']);
        await preview.start(ticket);
        const id = statuses[statuses.length - 1].id;
        await preview.apply(id);
        await preview.draftPR(id);
        expect(statuses[statuses.length - 1].pr).toEqual({ phase: 'ready', error: 'Add a GitHub remote named origin to open draft PRs.' });
        preview.cancelPR(id);
        expect(statuses[statuses.length - 1].pr).toBeUndefined();
      });
    });

    it('does not repair automatically after a manual test run', async () => {
      results = [passed, failed];
      await preview.start(ticket);
      const id = statuses[statuses.length - 1].id;
      await preview.apply(id);
      const calls = agentTurn.mock.calls.length;
      await preview.runTests(id);
      expect(statuses[statuses.length - 1]).toMatchObject({ phase: 'applied', testResult: failed, canFix: true });
      expect(agentTurn.mock.calls.length).toBe(calls);
    });
  });

  it('stops a model repeatedly proposing an unread file', async () => {
    agentTurn.mockImplementation(async () => call('propose_edit', { filePath: '../outside.ts', before: 'a', after: 'b' }));
    await preview.start(ticket);
    expect(agentTurn).toHaveBeenCalledTimes(18);
    expect(statuses[statuses.length - 1].phase).toBe('error');
    expect(snapshots).toEqual([]);
  });
});
