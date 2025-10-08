import { cosineSimilarity, rankChunks } from '../../utils/similarity';
import { CodeChunk } from '../../types';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 2, 3, 4];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('returns 0 for zero vectors', () => {
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });

  it('throws if vectors are different lengths', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow();
  });
});

describe('rankChunks', () => {
  const makeChunk = (id: number, embedding: number[]): CodeChunk => ({
    filePath: `file${id}.ts`,
    startLine: 0,
    endLine: 10,
    content: `content ${id}`,
    embedding,
  });

  it('returns top N chunks by similarity', () => {
    const query = [1, 0, 0];
    const chunks = [
      makeChunk(1, [0, 1, 0]),   // orthogonal — low score
      makeChunk(2, [1, 0, 0]),   // identical — highest score
      makeChunk(3, [0.5, 0.5, 0]), // partial match
    ];

    const ranked = rankChunks(query, chunks, 2);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].filePath).toBe('file2.ts');
  });

  it('skips chunks without embeddings', () => {
    const query = [1, 0];
    const chunks: CodeChunk[] = [
      { filePath: 'a.ts', startLine: 0, endLine: 5, content: 'x' },
      makeChunk(2, [1, 0]),
    ];
    const ranked = rankChunks(query, chunks, 5);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].filePath).toBe('file2.ts');
  });

  it('attaches score to returned chunks', () => {
    const query = [1, 0];
    const chunks = [makeChunk(1, [1, 0])];
    const ranked = rankChunks(query, chunks, 1);
    expect(ranked[0].score).toBeCloseTo(1);
  });
});