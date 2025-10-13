import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CacheManager } from '../../engine/CacheManager';
import { TicketData, EmbeddingIndex } from '../../types';

const makeTicket = (key: string): TicketData => ({
  key,
  summary: `Summary for ${key}`,
  description: 'Some description',
  acceptanceCriteria: '',
  status: 'Open',
  priority: 'Medium',
  labels: [],
  issueType: 'Story',
});

const makeIndex = (): EmbeddingIndex => ({
  version: 1,
  createdAt: new Date().toISOString(),
  chunks: [
    {
      filePath: 'src/index.ts',
      startLine: 0,
      endLine: 10,
      content: 'const x = 1;',
      embedding: [0.1, 0.2, 0.3],
    },
  ],
});

describe('CacheManager', () => {
  let tmpDir: string;
  let cache: CacheManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-test-'));
    cache = new CacheManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Ticket cache tests
  it('returns null for missing ticket', async () => {
    const result = await cache.getTicket('PROJ-999');
    expect(result).toBeNull();
  });

  it('saves and retrieves a ticket', async () => {
    const ticket = makeTicket('PROJ-123');
    await cache.saveTicket('PROJ-123', ticket);
    const result = await cache.getTicket('PROJ-123');
    expect(result).not.toBeNull();
    expect(result!.key).toBe('PROJ-123');
  });

  it('returns null for expired ticket', async () => {
    const ticket = makeTicket('PROJ-456');
    await cache.saveTicket('PROJ-456', ticket);

    // Manually expire by overwriting cachedAt
    const cachePath = path.join(tmpDir, 'ticket-cache.json');
    const raw = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    raw['PROJ-456'].cachedAt = Date.now() - 1000 * 60 * 60; // 1 hour ago
    fs.writeFileSync(cachePath, JSON.stringify(raw));

    const result = await cache.getTicket('PROJ-456');
    expect(result).toBeNull();
  });

  it('clears ticket cache', async () => {
    await cache.saveTicket('PROJ-123', makeTicket('PROJ-123'));
    await cache.clearTicketCache();
    const result = await cache.getTicket('PROJ-123');
    expect(result).toBeNull();
  });

  // Embedding index tests
  it('returns null for missing embedding index', async () => {
    const result = await cache.getEmbeddingIndex();
    expect(result).toBeNull();
  });

  it('saves and retrieves embedding index', async () => {
    const index = makeIndex();
    await cache.saveEmbeddingIndex(index);
    const result = await cache.getEmbeddingIndex();
    expect(result).not.toBeNull();
    expect(result!.chunks).toHaveLength(1);
    expect(result!.chunks[0].filePath).toBe('src/index.ts');
  });

  it('clears embedding index', async () => {
    await cache.saveEmbeddingIndex(makeIndex());
    await cache.clearEmbeddingIndex();
    const result = await cache.getEmbeddingIndex();
    expect(result).toBeNull();
  });
});