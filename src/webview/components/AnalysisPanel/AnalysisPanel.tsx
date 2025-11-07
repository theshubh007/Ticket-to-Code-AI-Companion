import React, { useState } from 'react';
import { CodeChunk } from '../../types';

interface Props {
  chunks: CodeChunk[] | null;
  error: string | null;
  loading: boolean;
  progress: { current: number; total: number } | null;
  disabled: boolean;
  onAnalyze: () => void;
  onOpenFile: (filePath: string, startLine: number, endLine: number) => void;
}

export function AnalysisPanel({
  chunks,
  error,
  loading,
  progress,
  disabled,
  onAnalyze,
  onOpenFile,
}: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const progressPct =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <section className={`panel ${disabled ? 'panel--disabled' : ''}`}>
      <div className="panel-header">
        <span className="panel-number">②</span>
        <h2 className="panel-title">Repo Analysis</h2>
        {chunks && (
          <span className="panel-badge success">{chunks.length} snippets</span>
        )}
      </div>

      <button
        className="btn btn-primary"
        onClick={onAnalyze}
        disabled={disabled || loading}
      >
        {loading ? (
          <span className="btn-loading">
            <span className="spinner-dot" />
            <span className="spinner-dot" />
            <span className="spinner-dot" />
          </span>
        ) : chunks ? (
          'Re-analyze'
        ) : (
          'Analyze Repo'
        )}
      </button>

      {loading && progress && (
        <div>
          <div className="progress-bar-wrap">
            <div
              className="progress-bar"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="hint">
            Embedding {progress.current} / {progress.total} chunks...
          </p>
        </div>
      )}

      {loading && !progress && (
        <p className="hint">Searching index...</p>
      )}

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {chunks && chunks.length === 0 && (
        <p className="hint">No relevant snippets found for this ticket.</p>
      )}

      {chunks && chunks.length > 0 && (
        <div className="snippet-list">
          {chunks.map((chunk, i) => {
            const isExpanded = expandedIndex === i;
            const previewLines = chunk.content
              .split('\n')
              .slice(0, 3)
              .join('\n');

            return (
              <div
                key={i}
                className="snippet-card"
                onClick={() => onOpenFile(chunk.filePath, chunk.startLine, chunk.endLine)}
              >
                <div className="snippet-card-header">
                  <span className="snippet-path">{chunk.filePath}</span>
                  {chunk.score !== undefined && (
                    <span className="snippet-score">
                      {(chunk.score * 100).toFixed(1)}%
                    </span>
                  )}
                </div>

                <p className="snippet-lines">
                  Lines {chunk.startLine}–{chunk.endLine}
                </p>

                <pre className="snippet-preview">{previewLines}</pre>

                <button
                  className="btn-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedIndex(isExpanded ? null : i);
                  }}
                >
                  {isExpanded ? 'Hide preview' : 'Full preview'}
                </button>

                {isExpanded && (
                  <pre className="snippet-preview snippet-preview--expanded">
                    {chunk.content}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}