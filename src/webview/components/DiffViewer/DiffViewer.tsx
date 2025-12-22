import React, { useState } from 'react';
import { FileDiff } from '../../types';
import './DiffViewer.css';

interface Props {
  diffs: FileDiff[];
  onAcceptAll: () => void;
  onCancel: () => void;
}

export function DiffViewer({ diffs, onAcceptAll, onCancel }: Props) {
  const [rejected, setRejected] = useState<Set<number>>(new Set());

  function toggleReject(i: number) {
    setRejected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  }

  const acceptedCount = diffs.length - rejected.size;

  return (
    <div className="diff-viewer">
      <div className="diff-viewer-header">
        <div className="diff-viewer-title">
          <span className="panel-number">④</span>
          <h2 className="panel-title">Review Changes</h2>
          <span className="panel-badge">{diffs.length} file{diffs.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="diff-viewer-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Discard All
          </button>
          <button
            className="btn btn-primary"
            onClick={onAcceptAll}
            disabled={acceptedCount === 0}
          >
            Apply {acceptedCount} file{acceptedCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      <div className="diff-file-list">
        {diffs.map((diff, i) => (
          <DiffFile
            key={diff.filePath}
            diff={diff}
            rejected={rejected.has(i)}
            onToggleReject={() => toggleReject(i)}
          />
        ))}
      </div>
    </div>
  );
}

interface DiffFileProps {
  diff: FileDiff;
  rejected: boolean;
  onToggleReject: () => void;
}

function DiffFile({ diff, rejected, onToggleReject }: DiffFileProps) {
  const [expanded, setExpanded] = useState(true);
  const lines = computeDiffLines(diff.oldCode, diff.newCode);

  return (
    <div className={`diff-file ${rejected ? 'diff-file--rejected' : ''}`}>
      <div className="diff-file-header" onClick={() => setExpanded((v) => !v)}>
        <span className="diff-file-chevron">{expanded ? '▼' : '▶'}</span>
        <span className="diff-file-path">{diff.filePath}</span>
        <div className="diff-file-meta">
          <span className="diff-badge diff-badge--add">+{lines.filter((l) => l.type === 'add').length}</span>
          <span className="diff-badge diff-badge--remove">-{lines.filter((l) => l.type === 'remove').length}</span>
        </div>
        <button
          className={`btn btn-sm ${rejected ? 'btn-primary' : 'btn-secondary'}`}
          onClick={(e) => { e.stopPropagation(); onToggleReject(); }}
        >
          {rejected ? 'Restore' : 'Skip'}
        </button>
      </div>

      {expanded && (
        <div className="diff-hunk">
          {lines.map((line, i) => (
            <div key={i} className={`diff-line diff-line--${line.type}`}>
              <span className="diff-line-prefix">
                {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
              </span>
              <span className="diff-line-content">{line.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface DiffLine {
  type: 'add' | 'remove' | 'context';
  text: string;
}

function computeDiffLines(oldCode: string, newCode: string): DiffLine[] {
  const oldLines = oldCode.split('\n');
  const newLines = newCode.split('\n');

  // Simple LCS-based unified diff
  const lcs = longestCommonSubsequence(oldLines, newLines);
  const result: DiffLine[] = [];
  let oi = 0;
  let ni = 0;
  let li = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    if (li < lcs.length && oi < oldLines.length && ni < newLines.length &&
        oldLines[oi] === lcs[li] && newLines[ni] === lcs[li]) {
      result.push({ type: 'context', text: oldLines[oi] });
      oi++; ni++; li++;
    } else if (ni < newLines.length && (li >= lcs.length || newLines[ni] !== lcs[li])) {
      result.push({ type: 'add', text: newLines[ni] });
      ni++;
    } else {
      result.push({ type: 'remove', text: oldLines[oi] });
      oi++;
    }
  }

  return result;
}

function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const m = Math.min(a.length, 300);
  const n = Math.min(b.length, 300);
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result;
}
