import * as fs from 'fs';

export interface MtimeRecord {
  [filePath: string]: number;
}

export function buildMtimeMap(filePaths: string[]): MtimeRecord {
  const record: MtimeRecord = {};
  for (const filePath of filePaths) {
    try {
      record[filePath] = fs.statSync(filePath).mtimeMs;
    } catch {
      // File may have been deleted — skip
    }
  }
  return record;
}

export function getChangedFiles(
  current: MtimeRecord,
  previous: MtimeRecord
): string[] {
  return Object.keys(current).filter(
    (filePath) => current[filePath] !== previous[filePath]
  );
}

export function getNewFiles(
  current: MtimeRecord,
  previous: MtimeRecord
): string[] {
  return Object.keys(current).filter(
    (filePath) => !(filePath in previous)
  );
}

export function getDeletedFiles(
  current: MtimeRecord,
  previous: MtimeRecord
): string[] {
  return Object.keys(previous).filter(
    (filePath) => !(filePath in current)
  );
}

export function mergeRecords(
  previous: MtimeRecord,
  updates: MtimeRecord
): MtimeRecord {
  return { ...previous, ...updates };
}