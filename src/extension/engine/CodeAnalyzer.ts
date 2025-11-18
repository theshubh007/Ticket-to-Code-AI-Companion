import * as fs from 'fs';
import { CodeChunk, EmbeddingIndex } from '../types';
import { walkWorkspace } from '../utils/fileWalker';
import { chunkFile } from '../utils/chunker';
import { rankChunks } from '../utils/similarity';
import { OpenAIClient } from '../clients/OpenAIClient';
import { CacheManager } from './CacheManager';
import { PerformanceMonitor } from '../utils/performanceMonitor';

const EMBEDDING_BATCH_SIZE = 50;
const MAX_CONCURRENT_BATCHES = 3;

export class CodeAnalyzer {
  private chunks: CodeChunk[] = [];
  private indexed = false;
  private monitor = new PerformanceMonitor();

  constructor(
    private readonly openAI: OpenAIClient,
    private readonly cache: CacheManager
  ) {}

  async indexWorkspace(
    rootPath: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    this.monitor.reset();
    this.monitor.start('total-indexing');

    // Load existing index from cache
    this.monitor.start('cache-load');
    const cached = await this.cache.getEmbeddingIndex();
    this.monitor.end('cache-load');

    const existingMap = new Map<string, CodeChunk[]>();
    if (cached) {
      for (const chunk of cached.chunks) {
        if (!existingMap.has(chunk.filePath)) {
          existingMap.set(chunk.filePath, []);
        }
        existingMap.get(chunk.filePath)!.push(chunk);
      }
    }

    // Walk workspace
    this.monitor.start('file-walk');
    const files = walkWorkspace(rootPath);
    this.monitor.end('file-walk');

    const allChunks: CodeChunk[] = [];
    const toEmbed: CodeChunk[] = [];

    // Determine which files need re-embedding
    this.monitor.start('chunk-prep');
    for (const file of files) {
      let content: string;
      try {
        content = fs.readFileSync(file.absolutePath, 'utf-8');
      } catch {
        continue;
      }

      const mtime = fs.statSync(file.absolutePath).mtimeMs;
      const fileChunks = chunkFile(content, file.relativePath);
      const cachedChunks = existingMap.get(file.relativePath);
      const cachedMtime = cachedChunks?.[0] as
        | (CodeChunk & { mtime?: number })
        | undefined;

      if (cachedChunks && cachedMtime?.mtime === mtime) {
        allChunks.push(...cachedChunks);
      } else {
        const stamped = fileChunks.map((c) => ({ ...c, mtime }));
        toEmbed.push(...stamped);
        allChunks.push(...stamped);
      }
    }
    this.monitor.end('chunk-prep');

    // Embed in parallel batches
    this.monitor.start('embedding');
    const total = toEmbed.length;
    let completed = 0;

    const batches: CodeChunk[][] = [];
    for (let i = 0; i < toEmbed.length; i += EMBEDDING_BATCH_SIZE) {
      batches.push(toEmbed.slice(i, i + EMBEDDING_BATCH_SIZE));
    }

    // Process batches with concurrency limit
    for (let i = 0; i < batches.length; i += MAX_CONCURRENT_BATCHES) {
      const concurrentBatches = batches.slice(i, i + MAX_CONCURRENT_BATCHES);

      await Promise.all(
        concurrentBatches.map(async (batch) => {
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

          completed += batch.length;
          onProgress?.(completed, total);
        })
      );
    }
    this.monitor.end('embedding');

    this.chunks = allChunks;
    this.indexed = true;

    // Persist updated index
    this.monitor.start('cache-save');
    const index: EmbeddingIndex = {
      version: 1,
      createdAt: new Date().toISOString(),
      chunks: allChunks,
    };
    await this.cache.saveEmbeddingIndex(index);
    this.monitor.end('cache-save');

    this.monitor.end('total-indexing');
    this.monitor.log();
  }

  async search(queryText: string, topN: number = 10): Promise<CodeChunk[]> {
    if (!this.indexed) {
      throw new Error('Workspace not indexed yet. Call indexWorkspace first.');
    }

    this.monitor.start('search');
    const [queryEmbedding] = await this.openAI.embed([queryText]);
    const results = rankChunks(queryEmbedding, this.chunks, topN);
    this.monitor.end('search');

    return results;
  }

  isIndexed(): boolean {
    return this.indexed;
  }

  getChunkCount(): number {
    return this.chunks.length;
  }

  getPerformanceSummary() {
    return this.monitor.getSummary();
  }
}