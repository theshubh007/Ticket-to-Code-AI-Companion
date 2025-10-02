import * as fs from 'fs';
import * as path from 'path';

// Directories to always skip regardless of .gitignore
const BLOCKED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  '.git',
  '.vscode',
  '.idea',
  '__pycache__',
  '.next',
  '.nuxt',
  'coverage',
  '.nyc_output',
  'vendor',
  '.cache',
]);

// File extensions we can meaningfully embed
const ALLOWED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx',
  '.py', '.java', '.cs', '.go',
  '.rb', '.php', '.swift', '.kt',
  '.rs', '.cpp', '.c', '.h',
  '.md', '.json', '.yaml', '.yml',
  '.html', '.css', '.scss',
  '.sh', '.bash',
]);

const MAX_FILE_SIZE_BYTES = 500 * 1024; // 500KB — skip huge generated files

export interface WalkedFile {
  absolutePath: string;
  relativePath: string;
  extension: string;
  sizeBytes: number;
}

export function walkWorkspace(rootPath: string): WalkedFile[] {
  const results: WalkedFile[] = [];
  walk(rootPath, rootPath, results);
  return results;
}

function walk(rootPath: string, currentPath: string, results: WalkedFile[]) {
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(currentPath, { withFileTypes: true });
  } catch {
    // Permission errors or broken symlinks — skip silently
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      if (!BLOCKED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        walk(rootPath, fullPath, results);
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      continue;
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.size > MAX_FILE_SIZE_BYTES) {
      continue;
    }

    results.push({
      absolutePath: fullPath,
      relativePath: path.relative(rootPath, fullPath),
      extension: ext,
      sizeBytes: stat.size,
    });
  }
}