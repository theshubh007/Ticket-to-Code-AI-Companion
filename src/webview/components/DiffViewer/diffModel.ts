import type { FileDiff } from '../../types';

/** Pure diff logic for the review screen, kept apart from React so it can be tested. */

// ─── Segment types ─────────────────────────────────────────────────────────

export interface ContextLine {
  text: string;
  oldLine: number;
  newLine: number;
}

export interface HunkLine {
  type: 'add' | 'remove';
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

export interface ContextSegment {
  kind: 'context';
  lines: ContextLine[];
}

export interface HunkSegment {
  kind: 'hunk';
  hunkIdx: number;
  lines: HunkLine[];
}

export type Segment = ContextSegment | HunkSegment;

// ─── Helpers ──────────────────────────────────────────────────────────────

export function longestCommonSubsequence(a: string[], b: string[]): string[] {
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

export function buildSegments(oldCode: string, newCode: string): Segment[] {
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

export function computePartialContent(segments: Segment[], rejectedHunks: Set<number>): string {
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

export interface FileDiffData {
  diff: FileDiff;
  segments: Segment[];
  totalAdds: number;
  totalRemoves: number;
  hunkCount: number;
}

export function buildFileDiffData(diff: FileDiff): FileDiffData {
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

/**
 * The files to write, given the developer's choices. Both maps are keyed by the file's index in
 * `files`, so the index must be taken before skipped files are filtered out.
 */
export function selectedChanges(
  files: FileDiffData[],
  skippedFiles: Set<number>,
  rejectedHunks: Map<number, Set<number>>
): { filePath: string; newCode: string }[] {
  return files.flatMap((fd, i) => skippedFiles.has(i) ? [] : [{
    filePath: fd.diff.filePath,
    newCode: computePartialContent(fd.segments, rejectedHunks.get(i) ?? new Set()),
  }]);
}
