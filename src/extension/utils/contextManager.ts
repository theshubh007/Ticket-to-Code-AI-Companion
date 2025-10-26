import { CodeChunk, TicketData } from '../types';

// Max tokens we can safely send to the LLM in the prompt
const MAX_CONTEXT_CHARS = 12000;
const MAX_SNIPPETS = 10;

export interface ContextBudget {
  chunks: CodeChunk[];
  totalChars: number;
  truncated: boolean;
}

export function buildContext(
  chunks: CodeChunk[],
  ticket: TicketData,
  maxChars: number = MAX_CONTEXT_CHARS,
  maxSnippets: number = MAX_SNIPPETS
): ContextBudget {
  const ticketChars = estimateTicketChars(ticket);
  const availableChars = maxChars - ticketChars;

  const selected: CodeChunk[] = [];
  let totalChars = 0;
  let truncated = false;

  // Chunks are already ranked by score — take as many as fit
  for (const chunk of chunks.slice(0, maxSnippets)) {
    const chunkChars = chunk.content.length + chunk.filePath.length + 50;

    if (totalChars + chunkChars > availableChars) {
      truncated = true;
      break;
    }

    selected.push(chunk);
    totalChars += chunkChars;
  }

  return { chunks: selected, totalChars, truncated };
}

export function estimateTicketChars(ticket: TicketData): number {
  return (
    ticket.summary.length +
    ticket.description.length +
    ticket.acceptanceCriteria.length +
    200 // overhead for labels, status, etc.
  );
}

export function deduplicateChunks(chunks: CodeChunk[]): CodeChunk[] {
  const seen = new Set<string>();
  return chunks.filter((chunk) => {
    const key = `${chunk.filePath}:${chunk.startLine}:${chunk.endLine}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function boostByFileType(chunks: CodeChunk[]): CodeChunk[] {
  const BOOST_EXTENSIONS: Record<string, number> = {
    '.ts': 1.0,
    '.tsx': 1.0,
    '.js': 0.95,
    '.jsx': 0.95,
    '.py': 0.9,
    '.java': 0.9,
    '.md': 0.7,   // docs are less relevant for implementation
    '.json': 0.6,
    '.yaml': 0.6,
    '.yml': 0.6,
  };

  return chunks
    .map((chunk) => {
      const ext = chunk.filePath.slice(chunk.filePath.lastIndexOf('.'));
      const boost = BOOST_EXTENSIONS[ext] ?? 0.8;
      return {
        ...chunk,
        score: (chunk.score ?? 0) * boost,
      };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}