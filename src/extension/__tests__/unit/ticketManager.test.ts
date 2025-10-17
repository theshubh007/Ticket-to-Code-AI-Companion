import { TicketManager } from '../../engine/TicketManager';
import { CacheManager } from '../../engine/CacheManager';
import { Security } from '../../engine/Security';
import { TicketData } from '../../types';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Mock JiraClient
jest.mock('../../clients/JiraClient', () => ({
  JiraClient: jest.fn().mockImplementation(() => ({
    getIssue: jest.fn().mockResolvedValue({
      key: 'PROJ-123',
      fields: {
        summary: 'Test ticket summary',
        description: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Test description' }],
            },
          ],
        },
        status: { name: 'In Progress' },
        priority: { name: 'High' },
        labels: ['frontend', 'bug'],
        issuetype: { name: 'Story' },
      },
    }),
  })),
}));

const mockSecrets = {
  get: jest.fn().mockResolvedValue('mock-value'),
  store: jest.fn(),
  delete: jest.fn(),
  onDidChange: jest.fn(),
};

describe('TicketManager', () => {
  let tmpDir: string;
  let cache: CacheManager;
  let security: Security;
  let manager: TicketManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-test-'));
    cache = new CacheManager(tmpDir);
    security = new Security(mockSecrets as never);
    manager = new TicketManager(security, cache);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  it('fetches and normalizes a ticket', async () => {
    const ticket = await manager.fetchTicket('PROJ-123');
    expect(ticket.key).toBe('PROJ-123');
    expect(ticket.summary).toBe('Test ticket summary');
    expect(ticket.description).toContain('Test description');
    expect(ticket.status).toBe('In Progress');
    expect(ticket.priority).toBe('High');
    expect(ticket.labels).toEqual(['frontend', 'bug']);
    expect(ticket.issueType).toBe('Story');
  });

  it('caches ticket on first fetch', async () => {
    await manager.fetchTicket('PROJ-123');
    const cached = await cache.getTicket('PROJ-123');
    expect(cached).not.toBeNull();
    expect(cached!.key).toBe('PROJ-123');
  });

  it('returns cached ticket on second fetch without calling Jira', async () => {
    const mockTicket: TicketData = {
      key: 'PROJ-456',
      summary: 'Cached ticket',
      description: 'From cache',
      acceptanceCriteria: '',
      status: 'Done',
      priority: 'Low',
      labels: [],
      issueType: 'Bug',
    };
    await cache.saveTicket('PROJ-456', mockTicket);
    const ticket = await manager.fetchTicket('PROJ-456');
    expect(ticket.summary).toBe('Cached ticket');
  });

  it('throws if Jira credentials are missing', async () => {
    mockSecrets.get.mockResolvedValue(undefined);
    await expect(manager.fetchTicket('PROJ-789')).rejects.toThrow(
      'Jira credentials not configured.'
    );
  });
});