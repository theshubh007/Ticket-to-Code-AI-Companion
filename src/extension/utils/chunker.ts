import { CodeChunk } from '../types';

const DEFAULT_CHUNK_SIZE = 80;    // lines per chunk
const DEFAULT_OVERLAP = 15;       // lines of overlap between chunks
const MAX_CHARS_PER_CHUNK = 20000; // Roughly 5k-8k tokens depending on language

export interface ChunkerOptions {
  chunkSize?: number;
  overlap?: number;
}

export function chunkFile(
  content: string,
  filePath: string,
  options: ChunkerOptions = {}
): CodeChunk[] {
  // Add this early return
  if (!content.trim()) {
    return [];
  }

  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;
  const lines = content.split('\n');

  // File is small enough to be a single chunk
  if (lines.length <= chunkSize) {
    let chunkContent = content.trim();
    if (chunkContent.length > MAX_CHARS_PER_CHUNK) {
      chunkContent = chunkContent.slice(0, MAX_CHARS_PER_CHUNK) + '\n... [truncated due to size]';
    }
    return [
      {
        filePath,
        startLine: 0,
        endLine: lines.length - 1,
        content: chunkContent,
      },
    ];
  }

  const chunks: CodeChunk[] = [];
  let start = 0;

  while (start < lines.length) {
    const end = Math.min(start + chunkSize - 1, lines.length - 1);
    const chunkLines = lines.slice(start, end + 1);
    let chunkContent = chunkLines.join('\n').trim();

    // Enforce character limit
    if (chunkContent.length > MAX_CHARS_PER_CHUNK) {
      chunkContent = chunkContent.slice(0, MAX_CHARS_PER_CHUNK) + '\n... [truncated due to size]';
    }

    // Skip chunks that are effectively empty
    if (chunkContent.length > 0) {
      chunks.push({
        filePath,
        startLine: start,
        endLine: end,
        content: chunkContent,
      });
    }

    // If we've reached the end, stop
    if (end >= lines.length - 1) {
      break;
    }

    start += chunkSize - overlap;
  }

  return chunks;
}

// Convenience: chunk multiple files at once
export function chunkFiles(
  files: { content: string; filePath: string }[],
  options: ChunkerOptions = {}
): CodeChunk[] {
  return files.flatMap(({ content, filePath }) =>
    chunkFile(content, filePath, options)
  );
}