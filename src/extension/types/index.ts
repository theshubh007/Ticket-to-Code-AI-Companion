// ─── Jira ────────────────────────────────────────────────────────────────────

export interface TicketSummary {
  key: string;
  summary: string;
  status: string;
  priority: string;
  issueType: string;
}

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
  model?: string;
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

export interface AISettingsPayload {
  chatModel: string;
  hasApiKey: boolean;
}

export interface FileDiff {
  filePath: string;
  oldCode: string;
  newCode: string;
}

export interface ModelSummary {
  id: string;
  name: string;
}

// ─── WebView Message Protocol ─────────────────────────────────────────────────
// Discriminated unions — every message has a command field as the discriminator

export type MessageFromWebview =
  | { command: 'ping' }
  | { command: 'getAISettings' }
  | {
      command: 'saveAISettings';
      payload: {
        chatModel: string;
        apiKey?: string;
      };
    }
  | { command: 'listTickets' }
  | { command: 'fetchTicket'; payload: { key: string } }
  | { command: 'analyzeRepo'; payload: { ticketDescription: string } }
  | { command: 'generateGuide' }
  | { command: 'implement' }
  | { command: 'applyDiffs'; payload: { diffs: FileDiff[] } }
  | { command: 'getModelList' }
  | { command: 'openFile'; payload: { filePath: string; startLine: number; endLine: number } };

export type MessageToWebview =
  | { command: 'pong'; payload: string }
  | { command: 'aiSettings'; payload: AISettingsPayload }
  | { command: 'aiSettingsSaved'; payload: string }
  | { command: 'aiSettingsError'; payload: string }
  | { command: 'ticketList'; payload: TicketSummary[] }
  | { command: 'ticketListError'; payload: string }
  | { command: 'ticketResult'; payload: TicketData }
  | { command: 'ticketError'; payload: string }
  | { command: 'analysisResult'; payload: CodeChunk[] }
  | { command: 'analysisError'; payload: string }
  | { command: 'guideResult'; payload: ImplementationGuide }
  | { command: 'guideError'; payload: string }
  | { command: 'indexingProgress'; payload: { current: number; total: number } }
  | { command: 'implementProgress'; payload: { step: number; total: number; stepTitle: string; phase: 'reading' | 'generating' | 'writing'; filePath?: string } }
  | { command: 'diffResult'; payload: { diffs: FileDiff[] } }
  | { command: 'implementResult'; payload: { filesModified: string[] } }
  | { command: 'implementError'; payload: string }
  | { command: 'modelList'; payload: ModelSummary[] }
  | { command: 'modelListError'; payload: string };