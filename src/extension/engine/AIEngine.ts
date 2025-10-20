import { OpenAIClient, ChatMessage } from '../clients/OpenAIClient';
import { TicketData, CodeChunk, ImplementationGuide, ImplementationStep, FileReference } from '../types';

const SYSTEM_PROMPT = `You are a senior software engineer helping a developer implement a Jira ticket.
You will be given a ticket description and relevant code snippets from the repository.
Your job is to produce a structured, actionable implementation guide grounded in the actual codebase.

You MUST respond with valid JSON only. No prose, no markdown fences, just raw JSON.

The JSON must match this exact shape:
{
  "steps": [
    {
      "stepNumber": 1,
      "title": "Short action-oriented title",
      "explanation": "Detailed explanation of what to do and why",
      "fileReferences": [
        {
          "filePath": "relative/path/to/file.ts",
          "startLine": 10,
          "endLine": 25,
          "description": "Why this file/range is relevant"
        }
      ]
    }
  ]
}

Rules:
- Every step must reference at least one file from the provided snippets
- File paths must exactly match paths provided in the snippets
- Line numbers must be within the ranges provided
- Steps must be in logical implementation order
- Aim for 4-8 steps total
- Be specific and technical, not generic`;

export class AIEngine {
  constructor(private readonly openAI: OpenAIClient) {}

  buildPrompt(ticket: TicketData, chunks: CodeChunk[]): ChatMessage[] {
    const ticketSection = this._formatTicket(ticket);
    const snippetsSection = this._formatSnippets(chunks);

    const userMessage = `Here is the Jira ticket you need to implement:

${ticketSection}

Here are the most relevant code snippets from the repository:

${snippetsSection}

Generate a step-by-step implementation guide as JSON.`;

    return [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ];
  }

  private _formatTicket(ticket: TicketData): string {
    const lines = [
      `Ticket Key: ${ticket.key}`,
      `Type: ${ticket.issueType}`,
      `Priority: ${ticket.priority}`,
      `Status: ${ticket.status}`,
      `Summary: ${ticket.summary}`,
    ];

    if (ticket.description) {
      lines.push(`\nDescription:\n${ticket.description}`);
    }

    if (ticket.acceptanceCriteria) {
      lines.push(`\nAcceptance Criteria:\n${ticket.acceptanceCriteria}`);
    }

    if (ticket.labels.length > 0) {
      lines.push(`\nLabels: ${ticket.labels.join(', ')}`);
    }

    return lines.join('\n');
  }

  private _formatSnippets(chunks: CodeChunk[]): string {
    return chunks
      .map((chunk, index) => {
        return [
          `--- Snippet ${index + 1} ---`,
          `File: ${chunk.filePath}`,
          `Lines: ${chunk.startLine}–${chunk.endLine}`,
          `Relevance Score: ${chunk.score?.toFixed(3) ?? 'N/A'}`,
          `\`\`\``,
          chunk.content,
          `\`\`\``,
        ].join('\n');
      })
      .join('\n\n');
  }
}