import React, { useState } from 'react';
import { FileDiff } from '../../types';
import { buildFileDiffData, FileDiffData, selectedChanges } from './diffModel';
import './DiffViewer.css';

interface Props {
  diffs: FileDiff[];
  onApply: (diffs: { filePath: string; newCode: string }[]) => void;
  onCancel: () => void;
}

// ─── DiffViewer ───────────────────────────────────────────────────────────

export function DiffViewer({ diffs, onApply, onCancel }: Props) {
  const [fileData] = useState<FileDiffData[]>(() => diffs.map(buildFileDiffData));
  const [rejectedHunks, setRejectedHunks] = useState<Map<number, Set<number>>>(new Map());
  const [skippedFiles, setSkippedFiles] = useState<Set<number>>(new Set());

  function toggleHunk(fileIdx: number, hunkIdx: number) {
    setRejectedHunks((prev) => {
      const next = new Map(prev);
      const fileSet = new Set(next.get(fileIdx) ?? []);
      if (fileSet.has(hunkIdx)) fileSet.delete(hunkIdx); else fileSet.add(hunkIdx);
      next.set(fileIdx, fileSet);
      return next;
    });
  }

  function toggleFile(fileIdx: number) {
    setSkippedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileIdx)) next.delete(fileIdx); else next.add(fileIdx);
      return next;
    });
  }

  function handleApply() {
    onApply(selectedChanges(fileData, skippedFiles, rejectedHunks));
  }

  const activeCount = fileData.length - skippedFiles.size;

  return (
    <div className="diff-viewer">
      <div className="diff-viewer-header">
        <div className="diff-viewer-title">
          <h1>Review changes</h1>
          <p>{fileData.length} file{fileData.length !== 1 ? 's' : ''} · skip files or reject hunks you don’t want</p>
        </div>
        <div className="button-row">
          <button type="button" className="btn btn--secondary" onClick={onCancel}><span>Cancel</span></button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleApply}
            disabled={activeCount === 0}
          >
            <span>Apply {activeCount} file{activeCount !== 1 ? 's' : ''}</span>
          </button>
        </div>
      </div>

      <div className="diff-file-list">
        {fileData.map((fd, i) => (
          <DiffFile
            key={fd.diff.filePath}
            data={fd}
            skipped={skippedFiles.has(i)}
            rejectedHunks={rejectedHunks.get(i) ?? new Set()}
            onToggleSkip={() => toggleFile(i)}
            onToggleHunk={(hunkIdx) => toggleHunk(i, hunkIdx)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── DiffFile ─────────────────────────────────────────────────────────────

interface DiffFileProps {
  data: FileDiffData;
  skipped: boolean;
  rejectedHunks: Set<number>;
  onToggleSkip: () => void;
  onToggleHunk: (hunkIdx: number) => void;
}

function DiffFile({ data, skipped, rejectedHunks, onToggleSkip, onToggleHunk }: DiffFileProps) {
  const [expanded, setExpanded] = useState(true);
  const acceptedHunks = data.hunkCount - rejectedHunks.size;

  return (
    <div className={`diff-file ${skipped ? 'diff-file--skipped' : ''}`}>
      <div className="diff-file-header" onClick={() => setExpanded((v) => !v)}>
        <span className={`diff-file-chevron${expanded ? ' diff-file-chevron--open' : ''}`} aria-hidden="true">›</span>
        <span className="diff-file-path">{data.diff.filePath}</span>
        <div className="diff-file-meta">
          <span className="diff-badge diff-badge--add">+{data.totalAdds}</span>
          <span className="diff-badge diff-badge--remove">−{data.totalRemoves}</span>
          {data.hunkCount > 1 && (
            <span className="diff-badge diff-badge--hunk">
              {acceptedHunks}/{data.hunkCount} hunks
            </span>
          )}
        </div>
        <button
          type="button"
          className="btn btn--small btn--plain"
          onClick={(e) => { e.stopPropagation(); onToggleSkip(); }}
        >
          <span>{skipped ? 'Include' : 'Skip'}</span>
        </button>
      </div>

      {expanded && (
        <div className="diff-hunk-list">
          {data.segments.map((seg, si) => {
            if (seg.kind === 'context') {
              return (
                <div key={`ctx-${si}`} className="diff-context-block">
                  {seg.lines.map((line, li) => (
                    <div key={li} className="diff-line diff-line--context">
                      <span className="diff-ln diff-ln--old">{line.oldLine}</span>
                      <span className="diff-ln diff-ln--new">{line.newLine}</span>
                      <span className="diff-line-prefix"> </span>
                      <span className="diff-line-content">{line.text}</span>
                    </div>
                  ))}
                </div>
              );
            }

            const rejected = rejectedHunks.has(seg.hunkIdx);
            return (
              <div key={`hunk-${seg.hunkIdx}`} className={`diff-hunk-block ${rejected ? 'diff-hunk-block--rejected' : ''}`}>
                <div className="diff-hunk-header">
                  <span className="diff-hunk-label">Hunk {seg.hunkIdx + 1}</span>
                  <button
                    type="button"
                    className="btn btn--small btn--plain"
                    onClick={() => onToggleHunk(seg.hunkIdx)}
                  >
                    <span>{rejected ? 'Keep' : 'Reject'}</span>
                  </button>
                </div>
                {seg.lines.map((line, li) => (
                  <div key={li} className={`diff-line diff-line--${line.type}`}>
                    <span className="diff-ln diff-ln--old">{line.oldLine ?? ''}</span>
                    <span className="diff-ln diff-ln--new">{line.newLine ?? ''}</span>
                    <span className="diff-line-prefix">
                      {line.type === 'add' ? '+' : '-'}
                    </span>
                    <span className="diff-line-content">{line.text}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
