import React, { useState } from 'react';
import { FileDiff } from '../../types';
import './DiffViewer.css';

interface Props {
  diffs: FileDiff[];
  onApply: (diffs: { filePath: string; newCode: string }[]) => void;
  onCancel: () => void;
}

// ─── Segment types ─────────────────────────────────────────────────────────

interface ContextLine {
  text: string;
  oldLine: number;
  newLine: number;
}

interface HunkLine {
  type: 'add' | 'remove';
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

interface ContextSegment {
  kind: 'context';
  lines: ContextLine[];
}

interface HunkSegment {
  kind: 'hunk';
  hunkIdx: number;
  lines: HunkLine[];
}

type Segment = ContextSegment | HunkSegment;

// ─── Helpers ──────────────────────────────────────────────────────────────

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
  let i = m, j = n;
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

function buildSegments(oldCode: string, newCode: string): Segment[] {
  const oldLines = oldCode ? oldCode.split('\n') : [];
  const newLines = newCode ? newCode.split('\n') : [];
  const lcsLines = longestCommonSubsequence(oldLines, newLines);

  type RawLine = { type: 'add' | 'remove' | 'context'; text: string };
  const raw: RawLine[] = [];
  let oi = 0, ni = 0, li = 0;
  while (oi < oldLines.length || ni < newLines.length) {
    if (
      li < lcsLines.length &&
      oi < oldLines.length &&
      ni < newLines.length &&
      oldLines[oi] === lcsLines[li] &&
      newLines[ni] === lcsLines[li]
    ) {
      raw.push({ type: 'context', text: oldLines[oi] });
      oi++; ni++; li++;
    } else if (ni < newLines.length && (li >= lcsLines.length || newLines[ni] !== lcsLines[li])) {
      raw.push({ type: 'add', text: newLines[ni] });
      ni++;
    } else {
      raw.push({ type: 'remove', text: oldLines[oi] });
      oi++;
    }
  }

  const segments: Segment[] = [];
  let oldNum = 1, newNum = 1, hunkIdx = 0, i = 0;

  while (i < raw.length) {
    if (raw[i].type === 'context') {
      const contextLines: ContextLine[] = [];
      while (i < raw.length && raw[i].type === 'context') {
        contextLines.push({ text: raw[i].text, oldLine: oldNum, newLine: newNum });
        oldNum++; newNum++; i++;
      }
      segments.push({ kind: 'context', lines: contextLines });
    } else {
      const hunkLines: HunkLine[] = [];
      while (i < raw.length && raw[i].type !== 'context') {
        if (raw[i].type === 'remove') {
          hunkLines.push({ type: 'remove', text: raw[i].text, oldLine: oldNum, newLine: null });
          oldNum++;
        } else {
          hunkLines.push({ type: 'add', text: raw[i].text, oldLine: null, newLine: newNum });
          newNum++;
        }
        i++;
      }
      segments.push({ kind: 'hunk', hunkIdx: hunkIdx++, lines: hunkLines });
    }
  }

  return segments;
}

function computePartialContent(segments: Segment[], rejectedHunks: Set<number>): string {
  const lines: string[] = [];
  for (const seg of segments) {
    if (seg.kind === 'context') {
      lines.push(...seg.lines.map((l) => l.text));
    } else {
      const rejected = rejectedHunks.has(seg.hunkIdx);
      for (const l of seg.lines) {
        if (l.type === 'remove') {
          if (rejected) lines.push(l.text);
        } else {
          if (!rejected) lines.push(l.text);
        }
      }
    }
  }
  return lines.join('\n');
}

// ─── Per-file data ─────────────────────────────────────────────────────────

interface FileDiffData {
  diff: FileDiff;
  segments: Segment[];
  totalAdds: number;
  totalRemoves: number;
  hunkCount: number;
}

function buildFileDiffData(diff: FileDiff): FileDiffData {
  const segments = buildSegments(diff.oldCode, diff.newCode);
  let totalAdds = 0, totalRemoves = 0, hunkCount = 0;
  for (const seg of segments) {
    if (seg.kind === 'hunk') {
      hunkCount++;
      for (const l of seg.lines) {
        if (l.type === 'add') totalAdds++;
        else totalRemoves++;
      }
    }
  }
  return { diff, segments, totalAdds, totalRemoves, hunkCount };
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
    const toApply = fileData
      .filter((_, i) => !skippedFiles.has(i))
      .map((fd, i) => ({
        filePath: fd.diff.filePath,
        newCode: computePartialContent(fd.segments, rejectedHunks.get(i) ?? new Set()),
      }));
    onApply(toApply);
  }

  const activeCount = fileData.length - skippedFiles.size;

  return (
    <div className="diff-viewer">
      <div className="diff-viewer-header">
        <div className="diff-viewer-title">
          <span className="panel-number">④</span>
          <h2 className="panel-title">Review Changes</h2>
          <span className="panel-badge">{fileData.length} file{fileData.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="diff-viewer-actions">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleApply}
            disabled={activeCount === 0}
          >
            Apply {activeCount} file{activeCount !== 1 ? 's' : ''}
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
        <span className="diff-file-chevron">{expanded ? '▼' : '▶'}</span>
        <span className="diff-file-path">{data.diff.filePath}</span>
        <div className="diff-file-meta">
          <span className="diff-badge diff-badge--add">+{data.totalAdds}</span>
          <span className="diff-badge diff-badge--remove">-{data.totalRemoves}</span>
          {data.hunkCount > 1 && (
            <span className="diff-badge diff-badge--hunk">
              {acceptedHunks}/{data.hunkCount} hunks
            </span>
          )}
        </div>
        <button
          className={`btn btn-sm ${skipped ? 'btn-primary' : 'btn-secondary'}`}
          onClick={(e) => { e.stopPropagation(); onToggleSkip(); }}
        >
          {skipped ? 'Restore' : 'Skip file'}
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
                    className={`btn btn-sm ${rejected ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => onToggleHunk(seg.hunkIdx)}
                  >
                    {rejected ? '↩ Restore' : '✕ Reject'}
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
