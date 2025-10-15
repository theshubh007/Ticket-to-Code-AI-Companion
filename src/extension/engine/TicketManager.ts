import { JiraClient } from '../clients/JiraClient';
import { CacheManager } from './CacheManager';
import { Security } from './Security';
import { TicketData } from '../types';
import { adfToText } from '../utils/adfToText';

export class TicketManager {
  constructor(
    private readonly security: Security,
    private readonly cache: CacheManager
  ) {}

  async fetchTicket(issueKey: string): Promise<TicketData> {
    // Check cache first
    const cached = await this.cache.getTicket(issueKey);
    if (cached) {
      return cached;
    }

    // Get credentials
    const jiraConfig = await this.security.getJiraConfig();
    if (!jiraConfig) {
      throw new Error('Jira credentials not configured.');
    }

    const client = new JiraClient(jiraConfig);
    const raw = await client.getIssue(issueKey);

    // Extract acceptance criteria from custom field if present
    const acceptanceCriteria = this._extractAcceptanceCriteria(raw.fields);

    const ticket: TicketData = {
      key: raw.key,
      summary: raw.fields.summary ?? '',
      description: adfToText(raw.fields.description),
      acceptanceCriteria,
      status: raw.fields.status?.name ?? 'Unknown',
      priority: raw.fields.priority?.name ?? 'Unknown',
      labels: raw.fields.labels ?? [],
      issueType: raw.fields.issuetype?.name ?? 'Unknown',
    };

    await this.cache.saveTicket(issueKey, ticket);
    return ticket;
  }

  private _extractAcceptanceCriteria(fields: Record<string, unknown>): string {
    // Jira stores AC in different custom fields depending on the instance
    // Common field names to check in order
    const acFieldKeys = [
      'customfield_10016',
      'customfield_10014',
      'customfield_10028',
      'customfield_10500',
      'acceptance_criteria',
    ];

    for (const key of acFieldKeys) {
      const value = fields[key];
      if (value) {
        return adfToText(value);
      }
    }

    return '';
  }
}