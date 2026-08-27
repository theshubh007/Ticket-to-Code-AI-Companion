import React, { useLayoutEffect, useRef, useState } from 'react';
import type { TicketAgentStatus } from '../../../extension/types';
import { TicketData, TicketSummary } from '../../types';
import { Icon } from '../shared/Icon';
import { Button, NavBar, Note, SectionHeading, Skeleton } from '../shared/ui';
import { IssueTypeIcon, PriorityLabel, StatusPill } from '../shared/ticketMeta';
import { ProposalCard } from './ProposalCard';

interface Props {
  /** The full ticket once it has loaded. */
  ticket: TicketData | null;
  /** The list entry the user picked, shown while the full ticket loads. */
  summary: TicketSummary | null;
  loading: boolean;
  error: string | null;
  agent: TicketAgentStatus | null;
  onBack?: () => void;
  onRetry: () => void;
  /** Secondary tools, shown below the ticket details. */
  children?: React.ReactNode;
}

/**
 * Everything about one ticket: its details, the fix-and-tests proposal and extra tools.
 * It takes all its data through props so it can move into its own editor tab later.
 */
export function TicketDetail({ ticket, summary, loading, error, agent, onBack, onRetry, children }: Props) {
  const head = ticket ?? summary;
  if (!head) return null;

  return (
    <div className="screen screen--push">
      {onBack && <NavBar backLabel="Tickets" onBack={onBack} />}

      <header className="ticket-header">
        <p className="ticket-eyebrow">
          <IssueTypeIcon issueType={head.issueType} size={14} />
          <span className="ticket-key">{head.key}</span>
          <span aria-hidden="true">·</span>
          <span>{head.issueType}</span>
        </p>
        <h1 className="ticket-title">{head.summary}</h1>
        <div className="ticket-meta">
          <StatusPill status={head.status} />
          <PriorityLabel priority={head.priority} />
          {ticket?.labels.map((label) => <span key={label} className="tag">{label}</span>)}
        </div>
      </header>

      {error && !loading && (
        <div className="content-inset">
          <Note
            tone="error"
            title="Couldn't load this ticket"
            action={<Button variant="plain" size="small" icon="refresh" onClick={onRetry}>Try again</Button>}
          >
            {error}
          </Note>
        </div>
      )}

      {loading && (
        <div className="content-inset stack" aria-busy="true" aria-label="Loading ticket">
          <Skeleton width="100%" height={88} />
          <Skeleton width="92%" />
          <Skeleton width="78%" />
          <Skeleton width="85%" />
        </div>
      )}

      {ticket && !loading && (
        <>
          <div className="content-inset">
            <ProposalCard ticketKey={ticket.key} agent={agent?.ticketKey === ticket.key ? agent : null} />
          </div>

          {ticket.description && (
            <>
              <SectionHeading>Description</SectionHeading>
              <div className="content-inset">
                <ClampedText text={ticket.description} />
              </div>
            </>
          )}

          {ticket.acceptanceCriteria && (
            <>
              <SectionHeading>Acceptance criteria</SectionHeading>
              <ul className="criteria content-inset">
                {criteriaLines(ticket.acceptanceCriteria).map((line, i) => (
                  <li key={i}>
                    <Icon name="circle" size={14} className="criteria-mark" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {children}
        </>
      )}
    </div>
  );
}

/** Splits acceptance criteria into one item per line, dropping list markers. */
function criteriaLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)]|\[[ xX]?\])\s*/, '').trim())
    .filter(Boolean);
}

function ClampedText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !expanded) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded]);

  return (
    <div className="clamped">
      <p ref={ref} className={`body-text${expanded ? '' : ' body-text--clamped'}`}>{text}</p>
      {(overflows || expanded) && (
        <button type="button" className="link-button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
