import React from 'react';
import { Icon, IconName } from './Icon';

export type Tone = 'neutral' | 'blue' | 'green' | 'orange' | 'red' | 'yellow' | 'purple';

/** Jira status names vary by project, so match on common words. */
export function statusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (/(done|closed|resolved|complete|released|fixed)/.test(s)) return 'green';
  if (/(block|reject|cancel)/.test(s)) return 'red';
  if (/(progress|review|testing|\bqa\b|develop|doing)/.test(s)) return 'blue';
  return 'neutral';
}

export function priorityMeta(priority: string): { tone: Tone; icon: IconName } {
  const p = priority.toLowerCase();
  if (/(highest|critical|blocker|urgent)/.test(p)) return { tone: 'red', icon: 'arrowUp' };
  if (/high/.test(p)) return { tone: 'orange', icon: 'arrowUp' };
  if (/(lowest|trivial)/.test(p)) return { tone: 'neutral', icon: 'arrowDown' };
  if (/low/.test(p)) return { tone: 'blue', icon: 'arrowDown' };
  return { tone: 'yellow', icon: 'equals' };
}

export function issueTypeMeta(issueType: string): { tone: Tone; icon: IconName } {
  const t = issueType.toLowerCase();
  if (t.includes('bug')) return { tone: 'red', icon: 'bug' };
  if (t.includes('story')) return { tone: 'green', icon: 'bookmark' };
  if (t.includes('epic')) return { tone: 'purple', icon: 'bolt' };
  if (t.includes('task')) return { tone: 'blue', icon: 'taskSquare' };
  return { tone: 'neutral', icon: 'file' };
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`pill tone-${statusTone(status)}`}>
      <span className="pill-dot" aria-hidden="true" />
      {status}
    </span>
  );
}

export function PriorityLabel({ priority, compact = false }: { priority: string; compact?: boolean }) {
  const { tone, icon } = priorityMeta(priority);
  return (
    <span className={`priority tone-${tone}`} title={`${priority} priority`}>
      <Icon name={icon} size={12} />
      <span className={compact ? 'visually-hidden' : undefined}>{priority}</span>
    </span>
  );
}

export function IssueTypeIcon({ issueType, size = 16 }: { issueType: string; size?: number }) {
  const { tone, icon } = issueTypeMeta(issueType);
  return (
    <span className={`issue-icon tone-${tone}`} title={issueType}>
      <Icon name={icon} size={size} />
    </span>
  );
}
