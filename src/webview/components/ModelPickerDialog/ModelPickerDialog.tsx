import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ModelSummary } from '../../types';

const PINNED_IDS = ['~anthropic/claude-haiku-latest', '~google/gemini-flash-latest'];
const PINNED_DEFAULTS: ModelSummary[] = [
  { id: '~anthropic/claude-haiku-latest', name: 'Claude Haiku (latest)' },
  { id: '~google/gemini-flash-latest', name: 'Gemini Flash (latest)' },
];

interface Props {
  currentModel: string;
  modelList: ModelSummary[] | null;
  modelListLoading: boolean;
  disabled?: boolean;
  onSelect: (modelId: string) => void;
}

export function ModelPickerDialog({ currentModel, modelList, modelListLoading, disabled, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const currentName = (() => {
    const all = [...PINNED_DEFAULTS, ...(modelList ?? [])];
    return all.find((m) => m.id === currentModel)?.name ?? currentModel;
  })();

  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [open]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  function handleSelect(id: string) {
    onSelect(id);
    setOpen(false);
  }

  const q = search.trim().toLowerCase();
  const pinnedItems = modelList
    ? modelList.filter((m) => PINNED_IDS.includes(m.id))
    : PINNED_DEFAULTS;
  const otherItems = (modelList ?? [])
    .filter((m) => !PINNED_IDS.includes(m.id))
    .filter((m) => !q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
  const filteredPinned = pinnedItems.filter(
    (m) => !q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
  );

  return (
    <>
      {/* Trigger — read-only clickable field */}
      <button
        type="button"
        className="model-picker-trigger"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-label={`Current model: ${currentName}. Click to change.`}
        title="Click to change model"
      >
        <span className="model-picker-name">{currentName}</span>
        <svg className="model-picker-chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="model-dialog-overlay" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="model-dialog"
            role="dialog"
            aria-label="Select a model"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search bar */}
            <div className="model-dialog-search-row">
              <svg className="model-dialog-search-icon" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.4" fill="none" />
                <line x1="10" y1="10" x2="14" y2="14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input
                ref={searchRef}
                className="model-dialog-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search all models"
                aria-label="Search models"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                className="model-dialog-close"
                onClick={() => setOpen(false)}
                aria-label="Close model picker"
                title="Close"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Model list */}
            <div className="model-dialog-list" role="listbox" aria-label="Available models">
              {modelListLoading && (modelList ?? []).length === 0 && (
                <p className="model-dialog-hint">Loading models…</p>
              )}

              {/* Pinned group */}
              {filteredPinned.length > 0 && (
                <div className="model-dialog-group">
                  <p className="model-dialog-group-label">Pinned</p>
                  {filteredPinned.map((m) => (
                    <ModelRow
                      key={m.id}
                      model={m}
                      selected={m.id === currentModel}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              )}

              {/* All other models */}
              {otherItems.length > 0 && (
                <div className="model-dialog-group">
                  <p className="model-dialog-group-label">All Models</p>
                  {otherItems.map((m) => (
                    <ModelRow
                      key={m.id}
                      model={m}
                      selected={m.id === currentModel}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              )}

              {!modelListLoading && filteredPinned.length === 0 && otherItems.length === 0 && (
                <p className="model-dialog-hint">No models match "{search}"</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ModelRow({
  model,
  selected,
  onSelect,
}: {
  model: ModelSummary;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={`model-dialog-item${selected ? ' model-dialog-item--selected' : ''}`}
      role="option"
      aria-selected={selected}
      onClick={() => onSelect(model.id)}
    >
      <div className="model-dialog-item-text">
        <span className="model-dialog-item-name">{model.name}</span>
        <span className="model-dialog-item-id">{model.id}</span>
      </div>
      {selected && (
        <svg className="model-dialog-check" viewBox="0 0 16 16" aria-hidden="true">
          <polyline points="3,8 7,12 13,4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      )}
    </button>
  );
}
