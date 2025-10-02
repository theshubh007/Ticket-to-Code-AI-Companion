import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { walkWorkspace } from '../../utils/fileWalker';

describe('walkWorkspace', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'walker-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('finds typescript files', () => {
    fs.writeFileSync(path.join(tmpDir, 'index.ts'), 'const x = 1;');
    const files = walkWorkspace(tmpDir);
    expect(files.some((f) => f.extension === '.ts')).toBe(true);
  });

  it('skips node_modules', () => {
    const nm = path.join(tmpDir, 'node_modules');
    fs.mkdirSync(nm);
    fs.writeFileSync(path.join(nm, 'index.ts'), 'const x = 1;');
    const files = walkWorkspace(tmpDir);
    expect(files.some((f) => f.relativePath.includes('node_modules'))).toBe(false);
  });

  it('skips files over 500KB', () => {
    const bigFile = path.join(tmpDir, 'big.ts');
    fs.writeFileSync(bigFile, 'x'.repeat(600 * 1024));
    const files = walkWorkspace(tmpDir);
    expect(files.some((f) => f.relativePath === 'big.ts')).toBe(false);
  });

  it('skips unsupported extensions', () => {
    fs.writeFileSync(path.join(tmpDir, 'image.png'), 'fake');
    const files = walkWorkspace(tmpDir);
    expect(files.some((f) => f.extension === '.png')).toBe(false);
  });

  it('returns relative paths', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.ts'), 'const x = 1;');
    const files = walkWorkspace(tmpDir);
    const found = files.find((f) => f.relativePath === path.join('src', 'app.ts'));
    expect(found).toBeDefined();
  });
});