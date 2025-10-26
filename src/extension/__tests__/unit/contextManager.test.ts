import {
  buildContext,
  deduplicateChunks,
  boostByFileType,
  estimateTicketChars,
} from '../../utils/contextManager';
import { CodeChunk, TicketData } from '../../types';

const makeChunk = (
  filePath: string,
  score: number,
  content: string = 'x'.repeat(100)
): CodeChunk => ({
  filePath,
  startLine: 0,
  endLine: 10,
  content,
  embedding: [],
  score,
});

const mockTicket: TicketData = {
  key: 'PROJ-1',
  summary: 'Test',
  description: 'A short description',
  acceptanceCriteria: '',
  status: 'Open',
  priority: 'Medium',
  labels: [],
  issueType: 'Story',
};

describe('buildContext', () => {
  it('returns top chunks within char budget', () => {
    const chunks = [
      makeChunk('a.ts', 0.9),
      makeChunk('b.ts', 0.8),
      makeChunk('c.ts', 0.7),
    ];
    const result = buildContext(chunks, mockTicket, 12000, 10);
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.truncated).toBe(false);
  });

  it('truncates when char budget exceeded', () => {
    const chunks = Array.from({ length: 20 }, (_, i) =>
      makeChunk(`file${i}.ts`, 0.9, 'x'.repeat(1000))
    );
    const result = buildContext(chunks, mockTicket, 3000, 10);
    expect(result.truncated).toBe(true);
    expect(result.chunks.length).toBeLessThan(20);
  });

  it('respects maxSnippets limit', () => {
    const chunks = Array.from({ length: 20 }, (_, i) =>
      makeChunk(`file${i}.ts`, 0.9)
    );
    const result = buildContext(chunks, mockTicket, 99999, 5);
    expect(result.chunks.length).toBeLessThanOrEqual(5);
  });
});

describe('deduplicateChunks', () => {
  it('removes exact duplicate chunks', () => {
    const chunks = [
      makeChunk('a.ts', 0.9),
      makeChunk('a.ts', 0.9),
      makeChunk('b.ts', 0.8),
    ];
    const result = deduplicateChunks(chunks);
    expect(result).toHaveLength(2);
  });

  it('keeps chunks with same file but different lines', () => {
    const chunks: CodeChunk[] = [
      { filePath: 'a.ts', startLine: 0, endLine: 10, content: 'x', score: 0.9 },
      { filePath: 'a.ts', startLine: 20, endLine: 30, content: 'y', score: 0.8 },
    ];
    const result = deduplicateChunks(chunks);
    expect(result).toHaveLength(2);
  });
});

describe('boostByFileType', () => {
  it('boosts ts files over md files', () => {
    const chunks = [
      makeChunk('readme.md', 0.9),
      makeChunk('app.ts', 0.9),
    ];
    const result = boostByFileType(chunks);
    const tsChunk = result.find((c) => c.filePath === 'app.ts');
    const mdChunk = result.find((c) => c.filePath === 'readme.md');
    expect(tsChunk!.score!).toBeGreaterThan(mdChunk!.score!);
  });

  it('sorts by boosted score descending', () => {
    const chunks = [
      makeChunk('readme.md', 0.95),
      makeChunk('app.ts', 0.8),
    ];
    const result = boostByFileType(chunks);
    expect(result[0].filePath).toBe('app.ts');
  });
});

describe('estimateTicketChars', () => {
  it('returns a positive number', () => {
    expect(estimateTicketChars(mockTicket)).toBeGreaterThan(0);
  });
});