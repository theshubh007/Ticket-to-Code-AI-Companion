import React, { useState, useEffect } from 'react';
import { TicketData, TicketSummary } from '../../types';
import { Spinner } from '../shared/Spinner';
import { ErrorBanner } from '../shared/ErrorBanner';

const OPENROUTER_MODELS = [
  '~anthropic/claude-haiku-latest',
  '~google/gemini-flash-latest',
];

interface Props {
  ticketList: TicketSummary[] | null;
  totalTicketCount: number;
  ticketSearch: string;
  chatModel: string;
  apiKeyInput: string;
  hasApiKey: boolean;
  settingsLoading: boolean;
  settingsError: string | null;
  settingsStatus: string | null;
  ticketListLoading: boolean;
  ticketListError: string | null;
  ticket: TicketData | null;
  error: string | null;
  loading: boolean;
  onTicketSearchChange: (value: string) => void;
  onChatModelChange: (value: string) => void;
  onApiKeyInputChange: (value: string) => void;
  onSaveAISettings: () => void;
  onFetch: (key: string) => void;
  onClearTicket: () => void;
  onRetryList: () => void;
}

export function TicketPanel({
  ticketList,
  totalTicketCount,
  ticketSearch,
  chatModel,
  apiKeyInput,
  hasApiKey,
  settingsLoading,
  settingsError,
  settingsStatus,
  ticketListLoading,
  ticketListError,
  ticket,
  error,
  loading,
  onTicketSearchChange,
  onChatModelChange,
  onApiKeyInputChange,
  onSaveAISettings,
  onFetch,
  onClearTicket,
  onRetryList,
}: Props) {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [expanded, setExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const trimmedSearch = ticketSearch.trim();
  const visibleTicketCount = ticketList?.length ?? 0;
  const hasActiveFilter = trimmedSearch.length > 0;
  const modelValue = OPENROUTER_MODELS.includes(chatModel)
    ? chatModel
    : OPENROUTER_MODELS[0];
  const modelOptions = OPENROUTER_MODELS;

  let ticketCountLabel = `${totalTicketCount} ${totalTicketCount === 1 ? 'ticket' : 'tickets'}`;
  if (hasActiveFilter && totalTicketCount !== visibleTicketCount) {
    ticketCountLabel = `${visibleTicketCount} of ${totalTicketCount} tickets`;
  }

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

  function handleModelSelect(value: string) {
    onChatModelChange(value);
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <span className="panel-number">①</span>
        <h2 className="panel-title">Jira Ticket</h2>
        <div className="panel-header-actions">
          {view === 'list' && !ticketListLoading && !ticketListError && ticketList !== null && (
            <span className="panel-count-badge">{ticketCountLabel}</span>
          )}
          {view === 'list' && (
            <button
              className="icon-btn"
              onClick={onRetryList}
              disabled={ticketListLoading}
              aria-label="Refresh assigned tickets"
              title="Refresh assigned tickets"
            >
              <svg
                className={`icon-refresh ${ticketListLoading ? 'spinning' : ''}`}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M12 4a8 8 0 0 1 7.75 6h-2.2A6 6 0 1 0 18 13h2a8 8 0 1 1-2.4-5.7L15 10h7V3l-2.78 2.78A9.92 9.92 0 0 0 12 2a10 10 0 1 0 10 10h-2A8 8 0 0 1 12 4Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          )}
          {view === 'list' && (
            <button
              className="icon-btn"
              onClick={() => setSettingsOpen((prev) => !prev)}
              aria-label="Open AI settings"
              title="AI settings"
            >
              <svg className="icon-gear" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.02 7.02 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.57.22-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.57-.22 1.12-.54 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          )}
        </div>
        {ticket && view === 'detail' && (
          <span className="panel-badge success">Fetched</span>
        )}
      </div>

      {view === 'list' && settingsOpen && (
        <div className="ticket-settings-card">
          <div className="settings-grid">
            <label className="settings-label" htmlFor="model-select">
              Model
            </label>
            <select
              id="model-select"
              className="text-input settings-select"
              value={modelValue}
              onChange={(event) => handleModelSelect(event.target.value)}
              disabled={settingsLoading}
            >
              {modelOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>

            <label className="settings-label" htmlFor="provider-key-input">
              API key
            </label>
            <input
              id="provider-key-input"
              className="text-input"
              type="password"
              value={apiKeyInput}
              onChange={(event) => onApiKeyInputChange(event.target.value)}
              placeholder={hasApiKey ? 'Saved key (leave blank to keep existing)' : 'Enter API key'}
              disabled={settingsLoading}
            />
          </div>

          <div className="settings-actions">
            <button className="btn btn-primary" onClick={onSaveAISettings} disabled={settingsLoading}>
              {settingsLoading ? 'Saving…' : 'Save'}
            </button>
          </div>

          {settingsStatus && !settingsLoading && <p className="status-msg">{settingsStatus}</p>}
          {settingsError && !settingsLoading && <ErrorBanner message={settingsError} />}
        </div>
      )}

      {view === 'list' && (
        <>
          {!ticketListLoading && !ticketListError && ticketList !== null && totalTicketCount > 0 && (
            <input
              className="text-input ticket-search-input"
              type="text"
              value={ticketSearch}
              onChange={(event) => onTicketSearchChange(event.target.value)}
              placeholder="Search by key or summary"
              aria-label="Filter assigned tickets"
            />
          )}

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
            totalTicketCount === 0 ? (
              <p className="hint">No tickets currently assigned to you.</p>
            ) : ticketList.length === 0 ? (
              <p className="hint">No tickets match your search.</p>
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
