import { CodeChunk } from '../types';

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must be the same length');
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;

  return dot / denom;
}

export function rankChunks(
  queryEmbedding: number[],
  chunks: CodeChunk[],
  topN: number = 10
): CodeChunk[] {
  const scored = chunks
    .filter((chunk) => chunk.embedding && chunk.embedding.length > 0)
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding!),
    }));

  scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return scored.slice(0, topN);
}