import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { AgentMessage, AssistantTurn, OpenAIClient } from '../../../clients/OpenAIClient';
import { CodeAnalyzer } from '../../../engine/CodeAnalyzer';
import { CacheManager } from '../../../engine/CacheManager';
import { runProjectTests } from '../../../engine/projectTests';
import { TicketPreview } from '../../../sidebar/TicketPreview';
import { TicketAgentStatus, TicketData } from '../../../types';

suite('Ticket fix and test review', () => {
  test('reviews and discards both files, then applies and runs the proposed regression test', async () => {
    const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
    const baseline = await fs.mkdtemp(path.join(os.tmpdir(), 'ticket-baseline-'));
    const filename = 'cache.cjs';
    const testPath = 'tests/expiry.test.cjs';
    const original = 'exports.expired = (start, ttl, now) => ttl > 0 && start + ttl < now;\n';
    const expected = original.replace('< now', '<= now');
    const assertion = 'assert.equal(expired(1000, 500, 1500), true)';
    const testCode = [
      "const test = require('node:test');",
      "const assert = require('node:assert/strict');",
      "const { expired } = require('../cache.cjs');",
      "test('before expiry', () => assert.equal(expired(1000, 500, 1499), false));",
      "test('at expiry', () => " + assertion + ');',
      "test('after expiry', () => assert.equal(expired(1000, 500, 1501), true));",
      "test('zero ttl', () => assert.equal(expired(1000, 0, 1501), false));",
      '',
    ].join('\n');
    const manifest = JSON.stringify({ scripts: { test: 'node --test tests/expiry.test.cjs' } });
    const ticket: TicketData = { key: 'KAN-2', summary: 'Expire at the end of the TTL',
      description: '', acceptanceCriteria: 'Check before, at and after expiry, and zero TTL.',
      labels: [], priority: '', status: '', issueType: '' };
    const statuses: TicketAgentStatus[] = [];
    const client = { async agentTurn(messages: AgentMessage[]): Promise<AssistantTurn> {
      const steps: [string, Record<string, string>][] = [
        ['search_code', { query: 'cache expired' }],
        ['read_file', { filePath: filename }],
        ['list_files', { query: 'test' }],
        ['list_files', { query: 'package.json' }],
        ['read_file', { filePath: 'package.json' }],
        ['propose_edit', { filePath: filename, purpose: 'fix', before: '< now', after: '<= now' }],
        ['propose_test_file', { filePath: testPath, content: testCode }],
        ['finish_proposal', { implementationPath: filename, coverage: 'Checks all four expiry cases.', testFilePath: testPath, assertion }],
      ];
      const last = messages[messages.length - 1];
      if (last.role === 'tool') assert.ok(!JSON.parse(last.content)?.error, last.content);
      const [name, args] = steps[messages.filter(message => message.role === 'assistant').length];
      return { role: 'assistant', content: null, tool_calls: [{ id: name, type: 'function',
        function: { name, arguments: JSON.stringify(args) } }] };
    } };
    const embeddings = new OpenAIClient({ apiKey: '' });
    embeddings.embed = async texts => texts.map(text => text.includes('expired') ? [1, 0] : [0, 1]);
    const analyzer = new CodeAnalyzer(embeddings, new CacheManager(path.join(root, '.test-cache')));
    const preview = new TicketPreview(client, analyzer, status => statuses.push(status), 'ticket-preview-test');
    const registration = vscode.workspace.registerTextDocumentContentProvider(preview.scheme, preview);
    const latest = () => statuses[statuses.length - 1];
    try {
      await fs.writeFile(path.join(root, filename), original, { flag: 'wx' });
      await fs.writeFile(path.join(root, 'package.json'), manifest, { flag: 'wx' });
      await preview.start(ticket);
      const first = latest();
      assert.strictEqual(first.phase, 'review', first.message);
      assert.deepStrictEqual(first.files?.map(file => file.filePath), [filename, testPath]);
      await preview.show(first.id, testPath);
      const testSnapshot = preview.snapshotUri(first.id, testPath, 'after');
      const proposedTest = (await vscode.workspace.openTextDocument(testSnapshot)).getText();
      assert.strictEqual(proposedTest, testCode);
      preview.discard(first.id);
      await preview.apply(first.id);
      assert.strictEqual(await fs.readFile(path.join(root, filename), 'utf8'), original);
      await assert.rejects(fs.stat(path.join(root, 'tests')), { code: 'ENOENT' });

      // Run the reviewed test against the original behavior in a separate workspace.
      await fs.mkdir(path.join(baseline, 'tests'));
      await fs.writeFile(path.join(baseline, testPath), proposedTest);
      await fs.writeFile(path.join(baseline, filename), original);
      await fs.writeFile(path.join(baseline, 'package.json'), manifest);
      const red = await runProjectTests(baseline, new AbortController().signal, () => {});
      assert.strictEqual(red.outcome, 'failed', red.output);
      assert.match(red.output, /at expiry/);

      await preview.start(ticket);
      const second = latest();
      assert.strictEqual(second.phase, 'review', second.message);
      await preview.apply(second.id);
      assert.strictEqual(latest().phase, 'applied', latest().message);
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(root, filename)));
      assert.strictEqual(doc.getText(), expected);
      assert.strictEqual(await fs.readFile(path.join(root, testPath), 'utf8'), testCode);
      if (doc.isDirty) {
        await preview.runTests(second.id);
        assert.match(latest().message, /Save cache.cjs/);
      }
      assert.ok(await vscode.workspace.saveAll());
      await preview.runTests(second.id);
      const green = latest().testResult;
      assert.strictEqual(green?.outcome, 'passed', green?.output ?? latest().message);
      for (const name of ['before expiry', 'at expiry', 'after expiry', 'zero ttl']) assert.ok(green.output.includes(name));
    } finally {
      registration.dispose();
      await fs.rm(baseline, { recursive: true, force: true });
      await fs.rm(path.join(root, filename), { force: true });
      await fs.rm(path.join(root, 'package.json'), { force: true });
      await fs.rm(path.join(root, 'tests'), { recursive: true, force: true });
    }
  });
});
