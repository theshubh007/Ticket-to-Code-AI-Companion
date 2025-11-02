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

export interface CodeChunk {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  score?: number;
}

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