// ─── Jira ────────────────────────────────────────────────────────────────────

export interface TicketData {
  key: string;
  summary: string;
  description: string;
  acceptanceCriteria: string;
  status: string;
  priority: string;
  labels: string[];
  issueType: string;
}

// ─── Code Analysis ───────────────────────────────────────────────────────────

export interface CodeChunk {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  embedding?: number[];
  score?: number;
}

export interface EmbeddingIndex {
  version: number;
  createdAt: string;
  chunks: CodeChunk[];
}

// ─── AI Guide ────────────────────────────────────────────────────────────────

export interface FileReference {
  filePath: string;
  startLine: number;
  endLine: number;
  description: string;
}

export interface ImplementationStep {
  stepNumber: number;
  title: string;
  explanation: string;
  fileReferences: FileReference[];
}

export interface ImplementationGuide {
  ticketKey: string;
  generatedAt: string;
  steps: ImplementationStep[];
}

// ─── WebView Message Protocol ─────────────────────────────────────────────────
// Discriminated unions — every message has a command field as the discriminator

export type MessageFromWebview =
  | { command: 'ping' }
  | { command: 'fetchTicket'; payload: { key: string } }
  | { command: 'analyzeRepo'; payload: { ticketDescription: string } }
  | { command: 'generateGuide' }
  | { command: 'openFile'; payload: { filePath: string; startLine: number; endLine: number } };

export type MessageToWebview =
  | { command: 'pong'; payload: string }
  | { command: 'ticketResult'; payload: TicketData }
  | { command: 'ticketError'; payload: string }
  | { command: 'analysisResult'; payload: CodeChunk[] }
  | { command: 'analysisError'; payload: string }
  | { command: 'guideResult'; payload: ImplementationGuide }
  | { command: 'guideError'; payload: string }
  | { command: 'indexingProgress'; payload: { current: number; total: number } };