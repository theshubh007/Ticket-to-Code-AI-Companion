import { OpenAIClient, ChatMessage } from '../clients/OpenAIClient';
import {
  TicketData,
  CodeChunk,
  ImplementationGuide,
  ImplementationStep,
  FileReference,
} from '../types';

export interface FileEdit {
  filePath: string;
  startLine: number;
  endLine: number;
  replacement: string;
}

const APPLY_SYSTEM_PROMPT = `You are a senior software engineer applying a specific code change to a file.
File contents are shown with line numbers in the format "  N: code".

Rules:
- startLine and endLine are the 1-based line numbers shown in the file listing
- replacement is the complete new code that replaces lines startLine..endLine inclusive — no line number prefixes
- To append new code at end of file, set both startLine and endLine to 0
- One edit object per contiguous change range
- Only include files that actually need changes for this step
- File paths must exactly match the paths provided
- Make minimal changes — only touch what this step requires

After your analysis, output the result wrapped in <output> tags:
<output>
{
  "edits": [
    {
      "filePath": "relative/path/to/file.ts",
      "startLine": 45,
      "endLine": 52,
      "replacement": "...new code..."
    }
  ]
}
</output>`;

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

interface RawGuideResponse {
  steps: {
    stepNumber: number;
    title: string;
    explanation: string;
    fileReferences: {
      filePath: string;
      startLine: number;
      endLine: number;
      description: string;
    }[];
  }[];
}

export class AIEngine {
  constructor(private readonly openAI: OpenAIClient) {}

  async fetchModels(apiKey: string): Promise<{ id: string; name: string }[]> {
    return this.openAI.fetchModels(apiKey);
  }

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

  async generateGuide(
    ticket: TicketData,
    chunks: CodeChunk[]
  ): Promise<ImplementationGuide> {
    const messages = this.buildPrompt(ticket, chunks);

    let raw: string;
    try {
      raw = await this.openAI.chat(messages, 'json');
    } catch (err) {
      throw new Error(`LLM call failed: ${(err as Error).message}`);
    }

    const parsed = this._parseGuide(raw, ticket.key);
    return parsed;
  }

  async applyStep(
    ticket: TicketData,
    step: ImplementationStep,
    fileContents: Map<string, string>
  ): Promise<FileEdit[]> {
    const fileSection = Array.from(fileContents.entries())
      .map(([fp, content]) => {
        const lines = content.split('\n');
        const width = String(lines.length).length;
        const numbered = lines
          .map((l, i) => `${String(i + 1).padStart(width, ' ')}: ${l}`)
          .join('\n');
        return `--- ${fp} ---\n${numbered}`;
      })
      .join('\n\n');

    const userMessage = `Ticket: ${ticket.key} — ${ticket.summary}${
      ticket.acceptanceCriteria ? `\nAcceptance Criteria:\n${ticket.acceptanceCriteria}` : ''
    }

Step ${step.stepNumber}: ${step.title}
${step.explanation}

Current file contents:

${fileSection}

Apply the changes for this step.`;

    let raw: string;
    try {
      raw = await this.openAI.chat(
        [
          { role: 'system', content: APPLY_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        'json',
        120000
      );
    } catch (err) {
      throw new Error(`LLM call failed: ${(err as Error).message}`);
    }

    const cleaned = this._cleanJson(raw);
    let parsed: { edits: { filePath: string; startLine: number; endLine: number; replacement: string }[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error('Failed to parse LLM response as JSON for step apply.');
    }

    if (!Array.isArray(parsed.edits)) {
      throw new Error('LLM response missing required "edits" array.');
    }

    return parsed.edits.map((e) => ({
      filePath: e.filePath ?? '',
      startLine: Number(e.startLine ?? 0),
      endLine: Number(e.endLine ?? 0),
      replacement: e.replacement ?? '',
    }));
  }

  private _cleanJson(raw: string): string {
    const outputMatch = raw.match(/<output>([\s\S]*?)<\/output>/i);
    if (outputMatch) return outputMatch[1].trim();

    return raw
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/^```json\s*/im, '')
      .replace(/^```\s*/im, '')
      .replace(/```\s*$/im, '')
      .trim();
  }

  private _parseGuide(raw: string, ticketKey: string): ImplementationGuide {
    let parsed: RawGuideResponse;

    try {
      // Strip markdown fences and recover the first balanced JSON object if the
      // model wrapped the answer in prose or extra commentary.
      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      parsed = JSON.parse(cleaned);
    } catch {
      try {
        const extracted = this._extractJsonObject(raw);
        parsed = JSON.parse(extracted);
      } catch {
        throw new Error(
          'Failed to parse LLM response as JSON. The model returned an unexpected format.'
        );
      }
    }

    if (!parsed.steps || !Array.isArray(parsed.steps)) {
      throw new Error('LLM response missing required "steps" array.');
    }

    const steps: ImplementationStep[] = parsed.steps.map((s, i) => {
      if (!s.title || !s.explanation) {
        throw new Error(`Step ${i + 1} is missing required fields.`);
      }

      const fileReferences: FileReference[] = (s.fileReferences ?? []).map(
        (ref) => ({
          filePath: ref.filePath ?? '',
          startLine: ref.startLine ?? 0,
          endLine: ref.endLine ?? 0,
          description: ref.description ?? '',
        })
      );

      return {
        stepNumber: s.stepNumber ?? i + 1,
        title: s.title,
        explanation: s.explanation,
        fileReferences,
      };
    });

    return {
      ticketKey,
      generatedAt: new Date().toISOString(),
      steps,
    };
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
          '```',
          chunk.content,
          '```',
        ].join('\n');
      })
      .join('\n\n');
  }

  private _extractJsonObject(raw: string): string {
    const start = raw.indexOf('{');
    if (start === -1) {
      throw new Error('No JSON object found in model response.');
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < raw.length; index += 1) {
      const char = raw[index];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          return raw.slice(start, index + 1);
        }
      }
    }

    throw new Error('Unbalanced JSON object in model response.');
  }
}