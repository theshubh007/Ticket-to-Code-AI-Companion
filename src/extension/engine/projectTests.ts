import { spawn } from 'child_process';
import { readFile, readdir } from 'fs/promises';
import * as path from 'path';
import { ProjectTestResult } from '../types';

type TestCommand = { executable: 'bazel' | 'npm'; args: string[] };

export async function detectTestCommand(root: string): Promise<TestCommand | undefined> {
  const files = await readdir(root);
  if (['MODULE.bazel', 'WORKSPACE', 'WORKSPACE.bazel'].some(file => files.includes(file))) {
    return { executable: 'bazel', args: ['test', '//...', '--test_output=errors', '--color=no'] };
  }
  if (files.includes('package.json')) {
    const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    const script = manifest.scripts?.test;
    if (typeof script === 'string' && script.trim() && script.trim() !== 'echo "Error: no test specified" && exit 1') {
      return { executable: 'npm', args: ['test'] };
    }
  }
  return undefined;
}

const OUTPUT_LIMIT = 64000;

export async function runProjectTests(root: string, signal: AbortSignal,
  started: (command: string) => void): Promise<ProjectTestResult> {
  const command = await detectTestCommand(root);
  signal.throwIfAborted();
  if (!command) {
    return { outcome: 'unavailable', summary: 'No test command found. This version supports Bazel workspaces and npm projects with a test script.', output: '' };
  }
  const label = [command.executable, ...command.args].join(' ');
  started(label);
  const windows = process.platform === 'win32';
  // npm is a .cmd shim on Windows. Only fixed arguments from detection enter cmd.exe.
  const useCmd = windows && command.executable === 'npm';
  const child = spawn(useCmd ? 'cmd.exe' : command.executable, useCmd ? ['/d', '/c', label] : command.args, {
    cwd: root, env: { ...process.env, CI: 'true', FORCE_COLOR: '0' },
    shell: false, detached: !windows, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });

  return new Promise<ProjectTestResult>((resolve) => {
    let output = '';
    let truncated = false;
    const append = (chunk: string) => {
      output += chunk;
      if (output.length > OUTPUT_LIMIT) {
        output = output.slice(-OUTPUT_LIMIT);
        truncated = true;
      }
    };
    child.stdout.setEncoding('utf8').on('data', append);
    child.stderr.setEncoding('utf8').on('data', append);

    const stop = () => {
      if (!child.pid) return;
      if (windows) {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
        killer.on('error', () => child.kill());
      } else {
        try { process.kill(-child.pid, 'SIGKILL'); }
        catch { /* Process group already exited. */ }
      }
    };
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop();
    let startError: NodeJS.ErrnoException | undefined;
    child.once('error', error => { startError = error; });
    child.once('close', (code, exitSignal) => {
      signal.removeEventListener('abort', stop);
      const log = (truncated ? '[Showing the last part of the test output]\n' : '') + output.trim();
      const result = (outcome: ProjectTestResult['outcome'], summary: string) =>
        resolve({ command: label, outcome, summary, output: log });

      if (signal.aborted) return result('cancelled', 'Test run stopped.');
      if (startError) return result('unavailable', startError.code === 'ENOENT'
        ? `Could not start ${command.executable}. Check that it is installed and on the VS Code PATH.`
        : startError.message);
      const noTests = command.executable === 'bazel' ? code === 4 :
        ((code === 0 || code === 1) && /^No tests found(?:, exiting with code [01])?[.\s]*$/im.test(output)) ||
        (code === 0 && /^(?:#|ℹ) tests 0\s*$/m.test(output));
      if (noTests) return result('empty', 'No tests were found.');
      if (code === 0) return result('passed', 'Test command passed.');
      return result('failed', exitSignal ? `Test run stopped by ${exitSignal}.` : `Test command failed (exit ${code}).`);
    });
  });
}
