import React from 'react';
import { TicketData } from '../../types';

interface Props {
  ticket: TicketData | null;
  error: string | null;
  loading: boolean;
  onFetch: (key: string) => void;
}

export function TicketPanel({ ticket, error, loading, onFetch }: Props) {
  const [key, setKey] = React.useState('');

  return (
    <section className="panel">
      <h2>① Jira Ticket</h2>
      <div className="input-row">
        <input
          className="text-input"
          type="text"
          placeholder="e.g. PROJ-123"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onFetch(key)}
        />
        <button
          className="btn btn-primary"
          onClick={() => onFetch(key)}
          disabled={loading}
        >
          {loading ? 'Fetching...' : 'Fetch Ticket'}
        </button>
      </div>
      {error && <p className="error-msg">{error}</p>}
      {ticket && (
        <div className="ticket-card">
          <p className="ticket-key">{ticket.key}</p>
          <p className="ticket-summary">{ticket.summary}</p>
          <div className="ticket-meta">
            <span className="badge">{ticket.status}</span>
            <span className="badge">{ticket.priority}</span>
            <span className="badge">{ticket.issueType}</span>
          </div>
          {ticket.description && (
            <p className="ticket-description">{ticket.description}</p>
          )}
        </div>
      )}
    </section>
  );
}