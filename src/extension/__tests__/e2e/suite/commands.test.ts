import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Commands', () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension(
      'undefined_publisher.ticket-to-code-ai-companion'
    );
    await ext?.activate();
  });

  test('resetCredentials command executes without error', async () => {
    let errorThrown = false;
    try {
      await vscode.commands.executeCommand('ticket-to-code.resetCredentials');
    } catch {
      errorThrown = true;
    }
    assert.strictEqual(errorThrown, false);
  });

  test('clearIndex command executes without error', async () => {
    let errorThrown = false;
    try {
      await vscode.commands.executeCommand('ticket-to-code.clearIndex');
    } catch {
      errorThrown = true;
    }
    assert.strictEqual(errorThrown, false);
  });
});