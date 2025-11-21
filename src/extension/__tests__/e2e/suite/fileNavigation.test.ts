import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('File Navigation', () => {
  let tmpDir: string;
  let tmpFile: string;

  suiteSetup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-nav-'));
    tmpFile = path.join(tmpDir, 'test.ts');
    fs.writeFileSync(
      tmpFile,
      Array.from({ length: 50 }, (_, i) => `// line ${i + 1}`).join('\n')
    );
  });

  suiteTeardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('opens a file in the editor', async () => {
    const uri = vscode.Uri.file(tmpFile);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);
    assert.ok(editor, 'Editor should be open');
    assert.strictEqual(
      editor.document.fileName,
      tmpFile,
      'Correct file should be open'
    );
  });

  test('reveals a range in the editor', async () => {
    const uri = vscode.Uri.file(tmpFile);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);

    const range = new vscode.Range(
      new vscode.Position(10, 0),
      new vscode.Position(20, 0)
    );
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    assert.ok(true, 'revealRange should not throw');
  });
});