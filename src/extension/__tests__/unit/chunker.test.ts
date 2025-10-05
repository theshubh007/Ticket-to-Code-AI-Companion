import { chunkFile } from '../../utils/chunker';

function makeLines(n: number): string {
  return Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n');
}

describe('chunkFile', () => {
  it('returns a single chunk for small files', () => {
    const content = makeLines(50);
    const chunks = chunkFile(content, 'small.ts');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].startLine).toBe(0);
    expect(chunks[0].filePath).toBe('small.ts');
  });

  it('splits large files into multiple chunks', () => {
    const content = makeLines(200);
    const chunks = chunkFile(content, 'large.ts');
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('chunks overlap correctly', () => {
    const content = makeLines(160);
    const chunks = chunkFile(content, 'overlap.ts', {
      chunkSize: 80,
      overlap: 15,
    });
    // Second chunk should start before first chunk ends
    expect(chunks[1].startLine).toBeLessThan(chunks[0].endLine);
  });

  it('last chunk ends at last line', () => {
    const content = makeLines(150);
    const chunks = chunkFile(content, 'end.ts');
    const lastChunk = chunks[chunks.length - 1];
    expect(lastChunk.endLine).toBe(149);
  });

  it('skips empty content', () => {
    const chunks = chunkFile('', 'empty.ts');
    expect(chunks).toHaveLength(0);
  });

  it('respects custom chunk size', () => {
    const content = makeLines(100);
    const chunks = chunkFile(content, 'custom.ts', {
      chunkSize: 30,
      overlap: 5,
    });
    expect(chunks[0].endLine).toBe(29);
  });
});