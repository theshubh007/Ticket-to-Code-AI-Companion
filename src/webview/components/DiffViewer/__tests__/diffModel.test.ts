/// <reference types="jest" />
import { buildFileDiffData, selectedChanges } from '../diffModel';

const files = [
  { filePath: 'a.ts', oldCode: 'a1\nshared', newCode: 'A1\nshared' },
  { filePath: 'b.ts', oldCode: 'one\nkeep\ntwo', newCode: 'ONE\nkeep\nTWO' },
  { filePath: 'c.ts', oldCode: 'c', newCode: 'C' },
].map(buildFileDiffData);

describe('selectedChanges', () => {
  it('applies every hunk when nothing is skipped or rejected', () => {
    expect(selectedChanges(files, new Set(), new Map())).toEqual([
      { filePath: 'a.ts', newCode: 'A1\nshared' },
      { filePath: 'b.ts', newCode: 'ONE\nkeep\nTWO' },
      { filePath: 'c.ts', newCode: 'C' },
    ]);
  });

  it('keeps each file’s rejected hunks after an earlier file is skipped', () => {
    // Skip a.ts, reject the second hunk of b.ts. Before the fix, b.ts read a.ts's choices
    // and c.ts read b.ts's, so b.ts got both hunks and c.ts lost its change.
    const rejected = new Map([[1, new Set([1])]]);
    expect(selectedChanges(files, new Set([0]), rejected)).toEqual([
      { filePath: 'b.ts', newCode: 'ONE\nkeep\ntwo' },
      { filePath: 'c.ts', newCode: 'C' },
    ]);
  });

  it('restores the old text of a fully rejected file', () => {
    expect(selectedChanges(files, new Set([0, 1]), new Map([[2, new Set([0])]])))
      .toEqual([{ filePath: 'c.ts', newCode: 'c' }]);
  });
});
