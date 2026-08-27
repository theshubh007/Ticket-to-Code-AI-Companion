import React, { useEffect, useRef } from 'react';
import { TicketSummary } from '../../types';
import { Icon } from '../shared/Icon';
import { Button, EmptyState, IconButton, Note, SectionHeading, Skeleton } from '../shared/ui';
import { IssueTypeIcon, PriorityLabel, statusTone } from '../shared/ticketMeta';

interface Props {
  tickets: TicketSummary[];
  totalCount: number;
  search: string;
  loading: boolean;
  error: string | null;
  needsApiKey: boolean;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onSelect: (ticket: TicketSummary) => void;
  onOpenSettings: () => void;
}

export function TicketList({
  tickets,
  totalCount,
  search,
  loading,
  error,
  needsApiKey,
  onSearchChange,
  onRefresh,
  onSelect,
  onOpenSettings,
}: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const filtering = search.trim().length > 0;
  const ready = !loading && !error;

  // "/" jumps to the filter field, as in most list views.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="screen">
      <div className="toolbar">
        <label className="search-field">
          <Icon name="search" size={14} className="search-field-icon" />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape' && search) { e.stopPropagation(); onSearchChange(''); } }}
            placeholder="Filter tickets"
            aria-label="Filter tickets by key or summary"
            disabled={!ready || totalCount === 0}
            spellCheck={false}
          />
          {search && (
            <button type="button" className="search-field-clear" onClick={() => onSearchChange('')} aria-label="Clear filter">
              <Icon name="xCircle" size={14} />
            </button>
          )}
        </label>
        <IconButton icon="refresh" label="Refresh tickets" onClick={onRefresh} disabled={loading} spinning={loading} />
        <IconButton icon="gear" label="Settings" onClick={onOpenSettings} />
      </div>

      {needsApiKey && (
        <div className="content-inset">
          <Note
            tone="info"
            title="Connect an AI model"
            action={<Button variant="plain" size="small" onClick={onOpenSettings}>Add API key</Button>}
          >
            Add an OpenRouter API key so the assistant can propose fixes and tests.
          </Note>
        </div>
      )}

      <SectionHeading
        trailing={ready && totalCount > 0 && (
          <span className="section-count">
            {filtering && tickets.length !== totalCount ? `${tickets.length} of ${totalCount}` : totalCount}
          </span>
        )}
      >
        Assigned to you
      </SectionHeading>

      {loading && (
        <ul className="group" aria-label="Loading tickets" aria-busy="true">
          {[72, 58, 84, 64].map((w, i) => (
            <li key={i} className="ticket-row ticket-row--skeleton">
              <Skeleton width={16} height={16} />
              <span className="ticket-row-text">
                <Skeleton width={`${w}%`} height={11} />
                <Skeleton width="38%" height={9} />
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && !loading && (
        <EmptyState
          icon="alert"
          title="Couldn't load tickets"
          message={error}
          action={<Button variant="secondary" icon="refresh" onClick={onRefresh}>Try again</Button>}
        />
      )}

      {ready && totalCount === 0 && (
        <EmptyState
          icon="tray"
          title="No assigned tickets"
          message="Jira tickets assigned to you will appear here."
          action={<Button variant="secondary" icon="refresh" onClick={onRefresh}>Refresh</Button>}
        />
      )}

      {ready && totalCount > 0 && tickets.length === 0 && (
        <EmptyState
          icon="search"
          title="No matches"
          message={<>No tickets match “{search.trim()}”.</>}
          action={<Button variant="plain" onClick={() => onSearchChange('')}>Clear filter</Button>}
        />
      )}

      {ready && tickets.length > 0 && (
        <ul className="group" aria-label="Assigned tickets">
          {tickets.map((t) => (
            <li key={t.key}>
              <button type="button" className="ticket-row" onClick={() => onSelect(t)}>
                <IssueTypeIcon issueType={t.issueType} />
                <span className="ticket-row-text">
                  <span className="ticket-row-title">{t.summary}</span>
                  <span className="ticket-row-meta">
                    <span className="ticket-key">{t.key}</span>
                    <span className={`status-inline tone-${statusTone(t.status)}`}>
                      <span className="pill-dot" aria-hidden="true" />
                      {t.status}
                    </span>
                    <PriorityLabel priority={t.priority} compact />
                  </span>
                </span>
                <Icon name="chevronRight" size={14} className="row-chevron" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
