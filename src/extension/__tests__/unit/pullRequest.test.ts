import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  branchName, commitOnBranch, describe as describePr, draftText, git, inspectRepository, openDraftPullRequest, parseGitHubRemote,
} from '../../engine/pullRequest';
import { TicketData } from '../../types';

const ticket: TicketData = { key: 'KAN-2', summary: 'Cache entries expire one millisecond late', description: '',
  acceptanceCriteria: 'Expire at the deadline', labels: [], priority: '', status: '', issueType: 'Bug',
  url: 'https://example.atlassian.net/browse/KAN-2' };
const files = [
  { filePath: 'src/cache.ts', purpose: 'fix' as const, isNew: false },
  { filePath: 'tests/cache.test.ts', purpose: 'test' as const, isNew: true },
];

describe('pull request helpers', () => {
  it.each([
    ['https://github.com/acme/widgets.git', 'acme', 'widgets'],
    ['https://token@github.com/acme/widgets', 'acme', 'widgets'],
    ['git@github.com:acme/my.repo.git', 'acme', 'my.repo'],
    ['ssh://git@github.com/acme/widgets.git', 'acme', 'widgets'],
  ])('reads %s', (url, owner, repo) => {
    expect(parseGitHubRemote(url)).toEqual({ owner, repo });
  });

  it.each(['https://gitlab.com/acme/widgets.git', 'https://github.com/acme', '/tmp/repo.git'])('rejects %s', url => {
    expect(parseGitHubRemote(url)).toBeUndefined();
  });

  it('names the branch after the ticket', () => {
    expect(branchName('KAN-2', 'Cache entries expire one millisecond late!')).toBe('ticket/KAN-2-cache-entries-expire-one-millisecond');
    expect(branchName('KAN-3', '«»')).toBe('ticket/KAN-3');
  });

  it('describes the ticket, files and test result', () => {
    const body = describePr({ ticket, files, repairs: 1,
      testResult: { command: 'npm test', outcome: 'passed', summary: '4 passed', output: '' } }, 'Fixes the comparison.');
    expect(body).toBe([
      'Resolves [KAN-2](https://example.atlassian.net/browse/KAN-2): Cache entries expire one millisecond late', '',
      'Fixes the comparison.', '',
      '### Changes', '- `src/cache.ts` (fix)', '- `tests/cache.test.ts` (new test)', '',
      '### Tests', '`npm test` passed after 1 repair attempt.',
    ].join('\n'));
    expect(describePr({ ticket: { ...ticket, url: undefined }, files, repairs: 0 }, '')).toContain('Resolves KAN-2: Cache');
    expect(describePr({ ticket, files, repairs: 0 }, '')).toContain('Tests were not run');
  });

  it('uses the model text, adds the ticket key if missing, and falls back on errors', async () => {
    const input = { ticket, files, repairs: 0, coverage: 'Covers the deadline.' };
    await expect(draftText(async () => JSON.stringify({ title: 'Expire entries at the deadline', summary: 'Uses <=.' }), input, ''))
      .resolves.toEqual({ title: 'KAN-2: Expire entries at the deadline', summary: 'Uses <=.' });
    await expect(draftText(async () => 'not json', input, ''))
      .resolves.toEqual({ title: 'KAN-2: Cache entries expire one millisecond late', summary: 'Covers the deadline.' });
    await expect(draftText(undefined, input, '')).resolves.toMatchObject({ title: 'KAN-2: Cache entries expire one millisecond late' });
  });

  it('reports GitHub errors with their details', async () => {
    const fetchFn = jest.fn(async () => ({ ok: false, status: 422, json: async () => ({
      message: 'Validation Failed', errors: [{ message: 'A pull request already exists for acme:ticket/KAN-2.' }] }) }));
    await expect(openDraftPullRequest(fetchFn, 't', { owner: 'acme', repo: 'widgets' }, { head: 'h', base: 'main', title: 't', body: 'b' }))
      .rejects.toThrow('GitHub returned 422: Validation Failed. A pull request already exists for acme:ticket/KAN-2.');
  });

  describe('with a repository', () => {
    let root: string;

    beforeEach(async () => {
      root = await fs.mkdtemp(path.join(os.tmpdir(), 'ticket-pr-'));
      await git(root, ['init', '-q', '-b', 'main']);
      await git(root, ['config', 'user.email', 'dev@example.com']);
      await git(root, ['config', 'user.name', 'Dev']);
      await fs.mkdir(path.join(root, 'src'));
      await fs.writeFile(path.join(root, 'src/cache.ts'), 'old\n');
      await fs.writeFile(path.join(root, 'notes.md'), 'notes\n');
      await git(root, ['add', '.']);
      await git(root, ['commit', '-q', '-m', 'Initial']);
      await git(root, ['remote', 'add', 'origin', 'git@github.com:acme/widgets.git']);
    });

    afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

    it('commits only the applied files on a new branch', async () => {
      await fs.writeFile(path.join(root, 'src/cache.ts'), 'new\n');
      await fs.mkdir(path.join(root, 'tests'));
      await fs.writeFile(path.join(root, 'tests/cache.test.ts'), 'test\n');
      await fs.writeFile(path.join(root, 'notes.md'), 'my own staged edit\n');
      await git(root, ['add', 'notes.md']);
      const paths = files.map(f => f.filePath);

      const state = await inspectRepository(root, paths, ticket.key, ticket.summary);
      expect(state).toMatchObject({ repo: { owner: 'acme', repo: 'widgets' }, current: 'main', currentOnRemote: false,
        branch: 'ticket/KAN-2-cache-entries-expire-one-millisecond' });
      expect(state.diff).toContain('+new');
      expect(state.diff).toContain('New file tests/cache.test.ts\ntest');

      await commitOnBranch(root, state, paths, 'KAN-2: Expire at the deadline', 'Uses <=.');
      expect((await git(root, ['branch', '--show-current'])).trim()).toBe(state.branch);
      expect((await git(root, ['log', '-1', '--format=%s%n%b'])).trim()).toBe('KAN-2: Expire at the deadline\nUses <=.');
      expect((await git(root, ['show', '--name-only', '--format=', 'HEAD'])).trim().split('\n').sort()).toEqual(paths.sort());
      // The developer's own staged change is still staged, not committed.
      expect((await git(root, ['diff', '--cached', '--name-only'])).trim()).toBe('notes.md');

      const again = await inspectRepository(root, ['notes.md'], ticket.key, ticket.summary);
      expect(again.branch).toBe(state.branch + '-2');
    });

    it('explains what is missing', async () => {
      await expect(inspectRepository(root, ['src/cache.ts'], 'KAN-2', 's')).rejects.toThrow('no uncommitted changes');
      await git(root, ['remote', 'set-url', 'origin', 'https://gitlab.com/acme/widgets.git']);
      await fs.writeFile(path.join(root, 'src/cache.ts'), 'new\n');
      await expect(inspectRepository(root, ['src/cache.ts'], 'KAN-2', 's')).rejects.toThrow('need a GitHub remote');
      await git(root, ['remote', 'remove', 'origin']);
      await expect(inspectRepository(root, ['src/cache.ts'], 'KAN-2', 's')).rejects.toThrow('remote named origin');
      const plain = await fs.mkdtemp(path.join(os.tmpdir(), 'ticket-plain-'));
      await expect(inspectRepository(plain, ['a'], 'KAN-2', 's')).rejects.toThrow('not a git repository');
      await fs.rm(plain, { recursive: true, force: true });
    });
  });
});
