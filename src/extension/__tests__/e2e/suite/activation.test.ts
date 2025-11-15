import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Activation', () => {
  test('extension activates successfully', async () => {
    const ext = vscode.extensions.getExtension('undefined_publisher.ticket-to-code-ai-companion');
    assert.ok(ext, 'Extension should be present');
    await ext!.activate();
    assert.strictEqual(ext!.isActive, true, 'Extension should be active');
  });

  test('resetCredentials command is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes('ticket-to-code.resetCredentials'),
      'resetCredentials command should be registered'
    );
  });

  test('clearIndex command is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes('ticket-to-code.clearIndex'),
      'clearIndex command should be registered'
    );
  });
});