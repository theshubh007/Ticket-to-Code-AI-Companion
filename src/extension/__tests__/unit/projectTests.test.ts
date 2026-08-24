import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { detectTestCommand, runProjectTests } from '../../engine/projectTests';

describe('workspace test commands', () => {
  let root: string;
  beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'ticket-tests-')); });
  afterEach(async () => { await fs.rm(root, { force: true, recursive: true }); });

  it('detects a Bazel module and requests test failure output', async () => {
    await fs.writeFile(path.join(root, 'MODULE.bazel'), '');
    expect(await detectTestCommand(root)).toEqual({
      executable: 'bazel', args: ['test', '//...', '--test_output=errors', '--color=no'],
    });
  });

  it('reports missing test configuration including the npm init placeholder', async () => {
    const run = () => runProjectTests(root, new AbortController().signal, jest.fn());
    expect((await run()).outcome).toBe('unavailable');
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({
      scripts: { test: 'echo "Error: no test specified" && exit 1' },
    }));
    expect((await run()).outcome).toBe('unavailable');
  });

  it('reports an empty node test suite', async () => {
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node --test --test-reporter=tap' } }));
    const result = await runProjectTests(root, new AbortController().signal, jest.fn());
    expect(result.output).toContain('# tests 0');
    expect(result.outcome).toBe('empty');
  });

  it('stops a running test command', async () => {
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node wait.cjs' } }));
    await fs.writeFile(path.join(root, 'wait.cjs'), 'setInterval(() => {}, 1000);');
    const controller = new AbortController();
    const result = await runProjectTests(root, controller.signal, () => setTimeout(() => controller.abort(), 200));
    expect(result.outcome).toBe('cancelled');
  });
});
