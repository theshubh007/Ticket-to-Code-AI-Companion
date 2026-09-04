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
  workspaceRoot?: string;
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
  | { command: 'previewTicket'; payload: { key: string } }
  | { command: 'reviewTicketChange'; payload: { id: string; filePath: string } }
  | { command: 'reviseTicketChange'; payload: { id: string; instruction: string } }
  | { command: 'applyTicketChange' | 'discardTicketChange' | 'runTicketTests' | 'stopTicketTests'; payload: { id: string } }
  | { command: 'fixTicketTests'; payload: { id: string; instruction?: string } }
  | { command: 'clearTicket' }
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
  | { command: 'applyDiffs'; payload: { diffs: { filePath: string; newCode: string }[] } }
  | { command: 'undoApply' }
  | { command: 'getModelList' }
  | { command: 'openFile'; payload: { filePath: string; startLine: number; endLine: number } };

export type MessageToWebview =
  | { command: 'ticketAgent'; payload: TicketAgentStatus }
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
  | { command: 'undoResult'; payload: { filesRestored: string[] } }
  | { command: 'undoError'; payload: string }
  | { command: 'conflictWarning'; payload: { conflictingPaths: string[] } }
  | { command: 'modelList'; payload: ModelSummary[] }
  | { command: 'modelListError'; payload: string };
export interface ProjectTestResult {
  command?: string;
  outcome: 'passed' | 'failed' | 'empty' | 'unavailable' | 'cancelled';
  summary: string;
  output: string;
}

export interface ProposalFile {
  filePath: string;
  purpose: 'fix' | 'test' | 'setup';
  isNew: boolean;
}

/** One visible action in a proposal run, shown as a timeline in the ticket card. */
export interface AgentStep {
  kind: 'index' | 'search' | 'list' | 'read' | 'edit' | 'discard' | 'finish' | 'request' | 'test' | 'repair';
  label: string;
  detail?: string;
  /** false when the action failed; the agent usually corrects itself on the next turn. */
  ok: boolean;
}

export interface TicketAgentStatus {
  files?: ProposalFile[];
  steps?: AgentStep[];
  /** True once a finished proposal can be revised with an instruction. */
  canRevise?: boolean;
  /**
   * Set while the agent continues a finished proposal: a requested change, or a repair after failing
   * tests. Cancel then stops only that run and keeps the earlier state.
   */
  revising?: 'change' | 'repair';
  /** True after Apply while the agent can still be asked to fix failing tests. */
  canFix?: boolean;
  /** The latest repair attempt after failing tests, and how many run without asking. */
  repair?: { attempt: number; max: number };
  coverage?: string;
  existingTest?: { filePath: string; startLine: number; endLine: number };
  testResult?: ProjectTestResult;
  id: string;
  ticketKey: string;
  phase: 'running' | 'review' | 'applying' | 'applied' | 'testing' | 'done' | 'error';
  message: string;
}
