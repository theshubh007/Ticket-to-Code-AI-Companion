import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { AssistantTurn, AgentMessage } from '../../clients/OpenAIClient';
import { CodeAnalyzer } from '../../engine/CodeAnalyzer';
import { CacheManager } from '../../engine/CacheManager';
import { OpenAIClient } from '../../clients/OpenAIClient';
import { TicketPreview } from '../../sidebar/TicketPreview';
import { TicketAgentStatus, TicketData } from '../../types';

const ticket: TicketData = { key: 'DEMO-1', summary: 'Explain an empty list', description: '',
  acceptanceCriteria: 'Display an empty state', labels: [], priority: '', status: '', issueType: '' };
const original = 'return items;\r\n';
const proposed = "return items.length ? items : 'No items';\r\n";
const target = 'list.ts';

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
    const doc = { getText: () => text, positionAt: (offset: number) => offset, isDirty: false };
    const editor = { edit: async (fn: (edit: { replace(range: unknown, value: string): void }) => void) => {
      fn({ replace: (_, value) => { text = value; } });
      return true;
    } };
    Object.assign(vscode.workspace, { workspaceFolders: [{ uri: { fsPath: root } }], openTextDocument: async () => doc });
    Object.assign(vscode.window, { showTextDocument: async () => editor });
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
      const file = JSON.parse(previous.content);
      return call('propose_edit', { filePath: file.filePath, before: file.content, after: proposed });
    });
    preview = new TicketPreview({ agentTurn }, {
      indexWorkspace: jest.fn(), search: async () => [{ filePath: target, content: original, startLine: 0, endLine: 0 }],
    }, status => statuses.push(status));
  });

  afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

  it('opens both snapshots and edits the document only on explicit Apply', async () => {
    await preview.start(ticket);
    const review = statuses[statuses.length - 1];
    expect(review).toMatchObject({ phase: 'review', message: 'Review the proposed change to list.ts.' });
    expect(snapshots).toEqual([original, proposed]);
    expect(agentTurn).toHaveBeenCalledTimes(3);
    expect(text).toBe(original);
    await preview.apply('unrelated-preview');
    expect(text).toBe(original);
    await preview.apply(review.id);
    expect(text).toBe(proposed);
    expect(await fs.readFile(path.join(root, target), 'utf8')).toBe(original);
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

  it('stops a model repeatedly proposing an unread file', async () => {
    agentTurn.mockImplementation(async () => call('propose_edit', { filePath: '../outside.ts', before: 'a', after: 'b' }));
    await preview.start(ticket);
    expect(agentTurn).toHaveBeenCalledTimes(8);
    expect(statuses[statuses.length - 1].phase).toBe('error');
    expect(snapshots).toEqual([]);
  });
});
