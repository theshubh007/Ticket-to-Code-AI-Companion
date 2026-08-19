import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  // Set when launched from inside another VS Code process; it would make the
  // test instance start as plain Node and reject its command-line options.
  delete process.env.ELECTRON_RUN_AS_NODE;

  // VS Code puts a socket in this folder and Unix socket paths are limited to
  // about 103 characters, so the default inside the repo fails on long paths.
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't2c-'));

  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../../');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [`--user-data-dir=${userDataDir}`],
    });
  } catch (err) {
    console.error('E2E test run failed:', err);
    process.exitCode = 1;
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

main();
