import React, { useState } from 'react';
import { TicketData } from '../../types';

interface Props {
  ticket: TicketData | null;
  error: string | null;
  loading: boolean;
  onFetch: (key: string) => void;
}

export function TicketPanel({ ticket, error, loading, onFetch }: Props) {
  const [key, setKey] = useState('');
  const [expanded, setExpanded] = useState(false);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && key.trim()) {
      onFetch(key.trim());
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <span className="panel-number">①</span>
        <h2 className="panel-title">Jira Ticket</h2>
        {ticket && <span className="panel-badge success">Fetched</span>}
      </div>

      <div className="input-row">
        <input
          className="text-input"
          type="text"
          placeholder="e.g. PROJ-123"
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          disabled={loading}
          spellCheck={false}
        />
        <button
          className="btn btn-primary"
          onClick={() => key.trim() && onFetch(key.trim())}
          disabled={loading || !key.trim()}
        >
          {loading ? (
            <span className="btn-loading">
              <span className="spinner-dot" />
              <span className="spinner-dot" />
              <span className="spinner-dot" />
            </span>
          ) : (
            'Fetch'
          )}
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {ticket && (
        <div className="ticket-card">
          <div className="ticket-card-header">
            <span className="ticket-key">{ticket.key}</span>
            <div className="ticket-badges">
              <span className={`badge badge--status`}>{ticket.status}</span>
              <span className={`badge badge--priority`}>{ticket.priority}</span>
              <span className="badge">{ticket.issueType}</span>
            </div>
          </div>

          <p className="ticket-summary">{ticket.summary}</p>

          {ticket.labels.length > 0 && (
            <div className="ticket-labels">
              {ticket.labels.map((label) => (
                <span key={label} className="label-chip">{label}</span>
              ))}
            </div>
          )}

          {ticket.description && (
            <div className="ticket-description-wrap">
              <p className={`ticket-description ${expanded ? 'expanded' : 'collapsed'}`}>
                {ticket.description}
              </p>
              <button
                className="btn-link"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            </div>
          )}

          {ticket.acceptanceCriteria && (
            <div className="ticket-ac">
              <p className="ticket-ac-label">Acceptance Criteria</p>
              <p className="ticket-ac-content">{ticket.acceptanceCriteria}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}