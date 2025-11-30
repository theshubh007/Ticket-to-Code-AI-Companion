import {
  validateIssueKey,
  validateJiraUrl,
  sanitizeFilePath,
  validateLineRange,
} from '../../utils/inputValidator';

describe('validateIssueKey', () => {
  it('accepts valid issue keys', () => {
    expect(validateIssueKey('PROJ-123').valid).toBe(true);
    expect(validateIssueKey('AB-1').valid).toBe(true);
    expect(validateIssueKey('MYPROJECT-9999').valid).toBe(true);
  });

  it('rejects empty key', () => {
    expect(validateIssueKey('').valid).toBe(false);
  });

  it('rejects lowercase keys', () => {
    expect(validateIssueKey('proj-123').valid).toBe(false);
  });

  it('rejects keys without number', () => {
    expect(validateIssueKey('PROJ').valid).toBe(false);
  });

  it('rejects keys with invalid characters', () => {
    expect(validateIssueKey('PROJ-12<script>').valid).toBe(false);
  });
});

describe('validateJiraUrl', () => {
  it('accepts valid https URLs', () => {
    expect(validateJiraUrl('https://company.atlassian.net').valid).toBe(true);
  });

  it('accepts valid http URLs', () => {
    expect(validateJiraUrl('http://jira.internal.com').valid).toBe(true);
  });

  it('rejects empty URL', () => {
    expect(validateJiraUrl('').valid).toBe(false);
  });

  it('rejects non-http protocols', () => {
    expect(validateJiraUrl('ftp://company.atlassian.net').valid).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(validateJiraUrl('not-a-url').valid).toBe(false);
  });
});

describe('sanitizeFilePath', () => {
  it('removes path traversal sequences', () => {
    expect(sanitizeFilePath('../../etc/passwd')).not.toContain('..');
  });

  it('removes leading slashes', () => {
    expect(sanitizeFilePath('/absolute/path')).not.toMatch(/^\//);
  });

  it('preserves normal paths', () => {
    expect(sanitizeFilePath('src/utils/helper.ts')).toBe('src/utils/helper.ts');
  });
});

describe('validateLineRange', () => {
  it('accepts valid range', () => {
    expect(validateLineRange(0, 10).valid).toBe(true);
  });

  it('accepts same start and end', () => {
    expect(validateLineRange(5, 5).valid).toBe(true);
  });

  it('rejects negative lines', () => {
    expect(validateLineRange(-1, 10).valid).toBe(false);
  });

  it('rejects start > end', () => {
    expect(validateLineRange(20, 10).valid).toBe(false);
  });

  it('rejects non-integer lines', () => {
    expect(validateLineRange(1.5, 10).valid).toBe(false);
  });
});