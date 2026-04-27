import React, { useState, useEffect } from 'react';
import { TicketData, TicketSummary } from '../../types';
import { Spinner } from '../shared/Spinner';
import { ErrorBanner } from '../shared/ErrorBanner';

interface Props {
  ticketList: TicketSummary[] | null;
  ticketListLoading: boolean;
  ticketListError: string | null;
  ticket: TicketData | null;
  error: string | null;
  loading: boolean;
  onFetch: (key: string) => void;
  onClearTicket: () => void;
  onRetryList: () => void;
}

export function TicketPanel({
  ticketList,
  ticketListLoading,
  ticketListError,
  ticket,
  error,
  loading,
  onFetch,
  onClearTicket,
  onRetryList,
}: Props) {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (ticket && !loading) {
      setView('detail');
      setExpanded(false);
    }
  }, [ticket, loading]);

  function handleBack() {
    setView('list');
    onClearTicket();
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <span className="panel-number">①</span>
        <h2 className="panel-title">Jira Ticket</h2>
        {ticket && view === 'detail' && (
          <span className="panel-badge success">Fetched</span>
        )}
      </div>

      {view === 'list' && (
        <>
          {ticketListLoading && (
            <Spinner label="Loading your tickets…" />
          )}

          {ticketListError && !ticketListLoading && (
            <>
              <ErrorBanner message={ticketListError} />
              <button className="btn btn-primary" onClick={onRetryList}>
                Retry
              </button>
            </>
          )}

          {!ticketListLoading && !ticketListError && ticketList !== null && (
            ticketList.length === 0 ? (
              <p className="hint">No tickets currently assigned to you.</p>
            ) : (
              <ul className="ticket-list">
                {ticketList.map((t) => (
                  <li key={t.key}>
                    <button
                      className="ticket-list-row"
                      onClick={() => onFetch(t.key)}
                      disabled={loading}
                    >
                      <div className="ticket-list-row-top">
                        <span className="ticket-key">{t.key}</span>
                        <div className="ticket-badges">
                          <span className="badge badge--status">{t.status}</span>
                          <span className="badge badge--priority">{t.priority}</span>
                          <span className="badge">{t.issueType}</span>
                        </div>
                      </div>
                      <p className="ticket-list-summary">{t.summary}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}

          {loading && <Spinner label="Fetching ticket…" />}

          {error && !loading && <ErrorBanner message={error} />}
        </>
      )}

      {view === 'detail' && ticket && (
        <>
          <button className="btn-link ticket-back" onClick={handleBack}>
            ← Back to list
          </button>

          <div className="ticket-card">
            <div className="ticket-card-header">
              <span className="ticket-key">{ticket.key}</span>
              <div className="ticket-badges">
                <span className="badge badge--status">{ticket.status}</span>
                <span className="badge badge--priority">{ticket.priority}</span>
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
        </>
      )}
    </section>
  );
}
