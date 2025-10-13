import * as fs from 'fs';
import * as path from 'path';
import { EmbeddingIndex, TicketData } from '../types';

const TICKET_CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

interface TicketCacheEntry {
  data: TicketData;
  cachedAt: number;
}

interface TicketCache {
  [key: string]: TicketCacheEntry;
}

export class CacheManager {
  private readonly embeddingIndexPath: string;
  private readonly ticketCachePath: string;

  constructor(private readonly storagePath: string) {
    fs.mkdirSync(storagePath, { recursive: true });
    this.embeddingIndexPath = path.join(storagePath, 'embedding-index.json');
    this.ticketCachePath = path.join(storagePath, 'ticket-cache.json');
  }

  // ─── Embedding Index ───────────────────────────────────────────────────────

  async getEmbeddingIndex(): Promise<EmbeddingIndex | null> {
    try {
      if (!fs.existsSync(this.embeddingIndexPath)) {
        return null;
      }
      const raw = fs.readFileSync(this.embeddingIndexPath, 'utf-8');
      return JSON.parse(raw) as EmbeddingIndex;
    } catch {
      return null;
    }
  }

  async saveEmbeddingIndex(index: EmbeddingIndex): Promise<void> {
    const raw = JSON.stringify(index, null, 2);
    fs.writeFileSync(this.embeddingIndexPath, raw, 'utf-8');
  }

  async clearEmbeddingIndex(): Promise<void> {
    if (fs.existsSync(this.embeddingIndexPath)) {
      fs.unlinkSync(this.embeddingIndexPath);
    }
  }

  // ─── Ticket Cache ──────────────────────────────────────────────────────────

  async getTicket(key: string): Promise<TicketData | null> {
    try {
      const cache = this._readTicketCache();
      const entry = cache[key];

      if (!entry) {
        return null;
      }

      const isExpired = Date.now() - entry.cachedAt > TICKET_CACHE_TTL_MS;
      if (isExpired) {
        delete cache[key];
        this._writeTicketCache(cache);
        return null;
      }

      return entry.data;
    } catch {
      return null;
    }
  }

  async saveTicket(key: string, data: TicketData): Promise<void> {
    const cache = this._readTicketCache();
    cache[key] = { data, cachedAt: Date.now() };
    this._writeTicketCache(cache);
  }

  async clearTicketCache(): Promise<void> {
    if (fs.existsSync(this.ticketCachePath)) {
      fs.unlinkSync(this.ticketCachePath);
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private _readTicketCache(): TicketCache {
    try {
      if (!fs.existsSync(this.ticketCachePath)) {
        return {};
      }
      const raw = fs.readFileSync(this.ticketCachePath, 'utf-8');
      return JSON.parse(raw) as TicketCache;
    } catch {
      return {};
    }
  }

  private _writeTicketCache(cache: TicketCache): void {
    fs.writeFileSync(this.ticketCachePath, JSON.stringify(cache, null, 2), 'utf-8');
  }
}