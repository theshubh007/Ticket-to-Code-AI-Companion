import { AIEngine } from '../../engine/AIEngine';
import { OpenAIClient } from '../../clients/OpenAIClient';
import { TicketData, CodeChunk } from '../../types';

jest.mock('../../clients/OpenAIClient');

const mockTicket: TicketData = {
  key: 'PROJ-123',
  summary: 'Add user authentication',
  description: 'Implement JWT-based authentication for the API.',
  acceptanceCriteria: 'User can login with email and password.',
  status: 'In Progress',
  priority: 'High',
  labels: ['backend', 'auth'],
  issueType: 'Story',
};

const mockChunks: CodeChunk[] = [
  {
    filePath: 'src/auth/auth.ts',
    startLine: 0,
    endLine: 20,
    content: 'export function authenticate(token: string) {}',
    embedding: [0.1, 0.2],
    score: 0.95,
  },
  {
    filePath: 'src/middleware/guard.ts',
    startLine: 5,
    endLine: 30,
    content: 'export function authGuard(req, res, next) {}',
    embedding: [0.1, 0.2],
    score: 0.87,
  },
];

const validResponse = JSON.stringify({
  steps: [
    {
      stepNumber: 1,
      title: 'Set up JWT authentication',
      explanation: 'Implement the core JWT logic in auth.ts',
      fileReferences: [
        {
          filePath: 'src/auth/auth.ts',
          startLine: 0,
          endLine: 20,
          description: 'Core auth function to modify',
        },
      ],
    },
    {
      stepNumber: 2,
      title: 'Update auth guard middleware',
      explanation: 'Wire the new JWT logic into the guard middleware',
      fileReferences: [
        {
          filePath: 'src/middleware/guard.ts',
          startLine: 5,
          endLine: 30,
          description: 'Middleware to update',
        },
      ],
    },
  ],
});

describe('AIEngine', () => {
  let engine: AIEngine;
  let mockOpenAI: jest.Mocked<OpenAIClient>;

  beforeEach(() => {
    mockOpenAI = new OpenAIClient({ apiKey: 'test' }) as jest.Mocked<OpenAIClient>;
    mockOpenAI.chat = jest.fn().mockResolvedValue(validResponse);
    engine = new AIEngine(mockOpenAI);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('buildPrompt returns system and user messages', () => {
    const messages = engine.buildPrompt(mockTicket, mockChunks);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('user prompt contains ticket key and summary', () => {
    const messages = engine.buildPrompt(mockTicket, mockChunks);
    expect(messages[1].content).toContain('PROJ-123');
    expect(messages[1].content).toContain('Add user authentication');
  });

  it('user prompt contains snippet file paths', () => {
    const messages = engine.buildPrompt(mockTicket, mockChunks);
    expect(messages[1].content).toContain('src/auth/auth.ts');
    expect(messages[1].content).toContain('src/middleware/guard.ts');
  });

  it('generateGuide returns parsed implementation guide', async () => {
    const guide = await engine.generateGuide(mockTicket, mockChunks);
    expect(guide.ticketKey).toBe('PROJ-123');
    expect(guide.steps).toHaveLength(2);
    expect(guide.steps[0].title).toBe('Set up JWT authentication');
    expect(guide.steps[0].fileReferences).toHaveLength(1);
  });

  it('generateGuide handles markdown-fenced JSON response', async () => {
    mockOpenAI.chat = jest.fn().mockResolvedValue(
      '```json\n' + validResponse + '\n```'
    );
    const guide = await engine.generateGuide(mockTicket, mockChunks);
    expect(guide.steps).toHaveLength(2);
  });

  it('generateGuide throws on invalid JSON', async () => {
    mockOpenAI.chat = jest.fn().mockResolvedValue('not valid json at all');
    await expect(engine.generateGuide(mockTicket, mockChunks)).rejects.toThrow(
      'Failed to parse LLM response as JSON'
    );
  });

  it('generateGuide throws if steps array is missing', async () => {
    mockOpenAI.chat = jest.fn().mockResolvedValue(JSON.stringify({ result: [] }));
    await expect(engine.generateGuide(mockTicket, mockChunks)).rejects.toThrow(
      'missing required "steps" array'
    );
  });
});