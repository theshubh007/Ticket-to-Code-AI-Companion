import React, { useState } from 'react';
import { CodeChunk } from '../../types';
import { Icon } from '../shared/Icon';
import { Button, Note } from '../shared/ui';

interface Props {
  chunks: CodeChunk[] | null;
  error: string | null;
  loading: boolean;
  progress: { current: number; total: number } | null;
  onAnalyze: () => void;
  onOpenFile: (filePath: string, startLine: number, endLine: number) => void;
}

/** Semantic search results for the ticket, shown inside the "Related code" disclosure. */
export function AnalysisPanel({ chunks, error, loading, progress, onAnalyze, onOpenFile }: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const pct = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="stack">
      <Button variant="secondary" block icon="search" onClick={onAnalyze} loading={loading}>
        {chunks ? 'Search again' : 'Search workspace'}
      </Button>

      {loading && (
        progress ? (
          <div className="stack stack--tight">
            <div className="progress progress--determinate" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Indexing">
              <span style={{ width: `${pct}%` }} />
            </div>
            <p className="card-status">Indexing {progress.current} of {progress.total} chunks…</p>
          </div>
        ) : (
          <p className="card-status">Searching the index…</p>
        )
      )}

      {error && <Note tone="error">{error}</Note>}

      {chunks && chunks.length === 0 && <p className="card-status">No related code found for this ticket.</p>}

      {chunks && chunks.length > 0 && (
        <ul className="group group--nested" aria-label="Related code">
          {chunks.map((chunk, i) => {
            const open = expandedIndex === i;
            const name = chunk.filePath.split('/').pop();
            return (
              <li key={`${chunk.filePath}:${chunk.startLine}`} className="snippet">
                <div className="file-row">
                  <button
                    type="button"
                    className="snippet-toggle"
                    aria-expanded={open}
                    onClick={() => setExpandedIndex(open ? null : i)}
                    title={chunk.filePath}
                  >
                    <Icon name="chevronRight" size={12} className={`snippet-chevron${open ? ' snippet-chevron--open' : ''}`} />
                    <span className="file-row-text">
                      <span className="file-row-name">{name}</span>
                      <span className="file-row-dir">Lines {chunk.startLine}–{chunk.endLine}</span>
                    </span>
                    {chunk.score !== undefined && (
                      <span className="tag" title="Similarity to the ticket">{Math.round(chunk.score * 100)}%</span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn--small"
                    onClick={() => onOpenFile(chunk.filePath, chunk.startLine, chunk.endLine)}
                    aria-label={`Open ${chunk.filePath} at line ${chunk.startLine}`}
                    title="Open in editor"
                  >
                    <Icon name="external" size={13} />
                  </button>
                </div>
                {open && <pre className="code-preview" tabIndex={0}>{chunk.content}</pre>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
