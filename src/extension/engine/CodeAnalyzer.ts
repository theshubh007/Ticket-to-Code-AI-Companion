import * as fs from 'fs';
import * as path from 'path';
import { CodeChunk, EmbeddingIndex } from '../types';
import { walkWorkspace } from '../utils/fileWalker';
import { chunkFile } from '../utils/chunker';
import { rankChunks } from '../utils/similarity';
import { OpenAIClient } from '../clients/OpenAIClient';
import { CacheManager } from './CacheManager';

const EMBEDDING_BATCH_SIZE = 50;

export class CodeAnalyzer {
  private chunks: CodeChunk[] = [];
  private indexed = false;

  constructor(
    private readonly openAI: OpenAIClient,
    private readonly cache: CacheManager
  ) {}

  async indexWorkspace(
    rootPath: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    // Load existing index from cache
    const cached = await this.cache.getEmbeddingIndex();
    const existingMap = new Map<string, CodeChunk[]>();

    if (cached) {
      for (const chunk of cached.chunks) {
        if (!existingMap.has(chunk.filePath)) {
          existingMap.set(chunk.filePath, []);
        }
        existingMap.get(chunk.filePath)!.push(chunk);
      }
    }

    const files = walkWorkspace(rootPath);
    const allChunks: CodeChunk[] = [];
    const toEmbed: CodeChunk[] = [];

    for (const file of files) {
      let content: string;
      try {
        content = fs.readFileSync(file.absolutePath, 'utf-8');
      } catch {
        continue;
      }

      const mtime = fs.statSync(file.absolutePath).mtimeMs;
      const fileChunks = chunkFile(content, file.relativePath);

      // Check if file has changed since last index
      const cachedChunks = existingMap.get(file.relativePath);
      const cachedMtime = cachedChunks?.[0] as (CodeChunk & { mtime?: number }) | undefined;

      if (cachedChunks && cachedMtime?.mtime === mtime) {
        // File unchanged — reuse cached embeddings
        allChunks.push(...cachedChunks);
      } else {
        // File changed or new — mark for re-embedding
        const stamped = fileChunks.map((c) => ({ ...c, mtime }));
        toEmbed.push(...stamped);
        allChunks.push(...stamped);
      }
    }

    // Embed in batches
    const total = toEmbed.length;
    let current = 0;

    for (let i = 0; i < toEmbed.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = toEmbed.slice(i, i + EMBEDDING_BATCH_SIZE);
      const texts = batch.map((c) => c.content);
      const embeddings = await this.openAI.embed(texts);

      for (let j = 0; j < batch.length; j++) {
        const chunkIndex = allChunks.findIndex(
          (c) =>
            c.filePath === batch[j].filePath &&
            c.startLine === batch[j].startLine
        );
        if (chunkIndex !== -1) {
          allChunks[chunkIndex].embedding = embeddings[j];
        }
      }

      current += batch.length;
      onProgress?.(current, total);
    }

    this.chunks = allChunks;
    this.indexed = true;

    // Persist updated index
    const index: EmbeddingIndex = {
      version: 1,
      createdAt: new Date().toISOString(),
      chunks: allChunks,
    };
    await this.cache.saveEmbeddingIndex(index);
  }

  async search(queryText: string, topN: number = 10): Promise<CodeChunk[]> {
    if (!this.indexed) {
      throw new Error('Workspace not indexed yet. Call indexWorkspace first.');
    }

    const [queryEmbedding] = await this.openAI.embed([queryText]);
    return rankChunks(queryEmbedding, this.chunks, topN);
  }

  isIndexed(): boolean {
    return this.indexed;
  }

  getChunkCount(): number {
    return this.chunks.length;
  }
}