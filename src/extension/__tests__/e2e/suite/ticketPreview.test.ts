import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { AgentMessage, AssistantTurn, OpenAIClient } from '../../../clients/OpenAIClient';
import { CodeAnalyzer } from '../../../engine/CodeAnalyzer';
import { CacheManager } from '../../../engine/CacheManager';
import { TicketPreview } from '../../../sidebar/TicketPreview';
import { TicketAgentStatus, TicketData } from '../../../types';

suite('Single-file ticket preview', () => {
  test('reviews a discovered file, discards, then applies and undoes an approved change', async () => {
    const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
    const filename = 'assigned-list.ts';
    const original = "export const emptyMessage = '';\n";
    const expected = "export const emptyMessage = 'No tickets';\n";
    const file = path.join(root, filename);
    const distractor = path.join(root, 'api.ts');
    await fs.writeFile(file, original, { flag: 'wx' });
    await fs.writeFile(distractor, "export const url = '/tickets';", { flag: 'wx' });
    const ticket: TicketData = { key: 'DEMO-1', summary: 'Show a message for an empty ticket list',
      description: '', acceptanceCriteria: '', labels: [], priority: '', status: '', issueType: '' };
    const statuses: TicketAgentStatus[] = [];
    const client = { async agentTurn(messages: AgentMessage[]): Promise<AssistantTurn> {
      const last = messages[messages.length - 1];
      let name = 'search_code';
      let args: Record<string, string> = { query: 'empty tickets' };
      if (last.role === 'tool') {
        const data = JSON.parse(last.content);
        if (last.tool_call_id === 'search_code') {
          name = 'read_file';
          args = { filePath: data[0].filePath };
        } else {
          name = 'propose_edit';
          args = { filePath: data.filePath, before: data.content, after: expected };
        }
      }
      return { role: 'assistant', content: null, tool_calls: [{ id: name, type: 'function',
        function: { name, arguments: JSON.stringify(args) } }] };
    } };
    const embeddings = new OpenAIClient({ apiKey: '' });
    embeddings.embed = async texts => texts.map(text => text.includes('empty') ? [1, 0] : [0, 1]);
    const analyzer = new CodeAnalyzer(embeddings, new CacheManager(path.join(root, '.test-cache')));
    const preview = new TicketPreview(client, analyzer, status => statuses.push(status), 'ticket-preview-test');
    const registration = vscode.workspace.registerTextDocumentContentProvider(preview.scheme, preview);
    try {
      await preview.start(ticket);
      const first = statuses[statuses.length - 1];
      assert.strictEqual(first.phase, 'review', first.message);
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
      assert.strictEqual(doc.getText(), original);
      assert.strictEqual(await fs.readFile(file, 'utf8'), original);
      const changed = vscode.Uri.from({ scheme: preview.scheme, path: '/' + filename, query: first.id + '/after' });
      assert.strictEqual((await vscode.workspace.openTextDocument(changed)).getText(), expected);
      preview.discard(first.id);
      await preview.apply(first.id);
      assert.strictEqual(doc.getText(), original);
      await preview.start(ticket);
      const second = statuses[statuses.length - 1];
      assert.strictEqual(second.phase, 'review', second.message);
      await preview.apply(second.id);
      const applied = statuses[statuses.length - 1];
      assert.strictEqual(applied.phase, 'done', applied.message);
      assert.strictEqual(doc.getText(), expected);
      assert.strictEqual(doc.isDirty, true);
      await vscode.commands.executeCommand('undo');
      assert.strictEqual(doc.getText(), original);
    } finally {
      registration.dispose();
      await fs.unlink(file);
      await fs.unlink(distractor);
    }
  });
});
