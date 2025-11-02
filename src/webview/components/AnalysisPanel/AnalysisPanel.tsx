import React from 'react';
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
  chunks, error, loading, progress, disabled, onAnalyze, onOpenFile,
}: Props) {
  return (
    <section className={`panel ${disabled ? 'panel--disabled' : ''}`}>
      <h2>② Repo Analysis</h2>
      <button
        className="btn btn-primary"
        onClick={onAnalyze}
        disabled={disabled || loading}
      >
        {loading ? 'Analyzing...' : 'Analyze Repo'}
      </button>
      {progress && (
        <p className="hint">
          Indexing {progress.current} / {progress.total} chunks...
        </p>
      )}
      {error && <p className="error-msg">{error}</p>}
      {chunks && chunks.map((chunk, i) => (
        <div
          key={i}
          className="snippet-card"
          onClick={() => onOpenFile(chunk.filePath, chunk.startLine, chunk.endLine)}
        >
          <p className="snippet-path">{chunk.filePath}</p>
          <p className="snippet-lines">Lines {chunk.startLine}–{chunk.endLine}</p>
          {chunk.score !== undefined && (
            <p className="snippet-score">Score: {chunk.score.toFixed(3)}</p>
          )}
        </div>
      ))}
    </section>
  );
}