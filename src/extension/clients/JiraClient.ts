import * as https from 'https';
import * as http from 'http';

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface RawJiraIssue {
  key: string;
  fields: {
    summary: string;
    description: unknown;       // ADF format — parsed later by adfToText
    status: { name: string };
    priority: { name: string };
    labels: string[];
    issuetype: { name: string };
    [key: string]: unknown;     // Jira fields are open-ended
  };
}

export class JiraClient {
  constructor(private readonly config: JiraConfig) {}

  async getIssue(issueKey: string): Promise<RawJiraIssue> {
    const url = `${this.config.baseUrl}/rest/api/3/issue/${issueKey}`;
    const token = Buffer.from(
      `${this.config.email}:${this.config.apiToken}`
    ).toString('base64');

    return this._get(url, {
      Authorization: `Basic ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
  }

  private _get(url: string, headers: Record<string, string>): Promise<RawJiraIssue> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const lib = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers,
      };

      const req = lib.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => (data += chunk));

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error('Failed to parse Jira response as JSON'));
            }
          } else if (res.statusCode === 401) {
            reject(new Error('Jira authentication failed. Check your email and API token.'));
          } else if (res.statusCode === 403) {
            reject(new Error('Jira access forbidden. Check your permissions.'));
          } else if (res.statusCode === 404) {
            reject(new Error(`Jira issue not found. Check the issue key.`));
          } else {
            reject(new Error(`Jira API error: HTTP ${res.statusCode} — ${data}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Network error reaching Jira: ${err.message}`));
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Jira request timed out after 10s'));
      });

      req.end();
    });
  }
}