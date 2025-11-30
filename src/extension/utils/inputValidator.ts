// Input validation and sanitization utilities
// Prevents injection attacks and malformed data reaching the engine

export function validateIssueKey(key: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = key.trim();

  if (!trimmed) {
    return { valid: false, error: 'Issue key cannot be empty.' };
  }

  // Jira issue keys follow pattern: PROJECT-123
  const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9_]{1,9}-\d{1,6}$/;
  if (!ISSUE_KEY_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: 'Invalid issue key format. Expected format: PROJ-123',
    };
  }

  return { valid: true };
}

export function validateJiraUrl(url: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = url.trim();

  if (!trimmed) {
    return { valid: false, error: 'Jira URL cannot be empty.' };
  }

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Jira URL must use http or https.' };
    }
    if (!parsed.hostname.includes('.')) {
      return { valid: false, error: 'Jira URL must be a valid hostname.' };
    }
  } catch {
    return { valid: false, error: 'Jira URL is not a valid URL.' };
  }

  return { valid: true };
}

export function sanitizeFilePath(filePath: string): string {
  // Prevent path traversal attacks
  return filePath
    .replace(/\.\.\//g, '')
    .replace(/\.\.\\/g, '')
    .replace(/^\//, '')
    .trim();
}

export function validateLineRange(
  startLine: number,
  endLine: number
): { valid: boolean; error?: string } {
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine)) {
    return { valid: false, error: 'Line numbers must be integers.' };
  }
  if (startLine < 0 || endLine < 0) {
    return { valid: false, error: 'Line numbers must be non-negative.' };
  }
  if (startLine > endLine) {
    return { valid: false, error: 'Start line must be <= end line.' };
  }
  return { valid: true };
}