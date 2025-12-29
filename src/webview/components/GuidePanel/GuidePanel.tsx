import React, { useState, useEffect, useRef } from 'react';
import { ImplementationGuide, ImplementationStep, FileReference, FileDiff } from '../../types';

interface Props {
  guide: ImplementationGuide | null;
  error: string | null;
  loading: boolean;
  disabled: boolean;
  onGenerate: () => void;
  onOpenFile: (filePath: string, startLine: number, endLine: number) => void;
  implementLoading: boolean;
  implementLog: string[];
  implementResult: { filesModified: string[] } | null;
  implementError: string | null;
  onImplement: () => void;
  lastAppliedDiffs: FileDiff[] | null;
  undoLoading: boolean;
  undoStatus: string | null;
  undoError: string | null;
  conflictWarning: string[] | null;
  onUndo: () => void;
}

export function GuidePanel({
  guide,
  error,
  loading,
  disabled,
  onGenerate,
  onOpenFile,
  implementLoading,
  implementLog,
  implementResult,
  implementError,
  onImplement,
  lastAppliedDiffs,
  undoLoading,
  undoStatus,
  undoError,
  conflictWarning,
  onUndo,
}: Props) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [confirmImplement, setConfirmImplement] = useState(false);

  return (
    <section className={`panel ${disabled ? 'panel--disabled' : ''}`}>
      <div className="panel-header">
        <span className="panel-number">③</span>
        <h2 className="panel-title">Implementation Guide</h2>
        {guide && (
          <span className="panel-badge success">{guide.steps.length} steps</span>
        )}
      </div>

      <button
        className="btn btn-primary"
        onClick={onGenerate}
        disabled={disabled || loading}
      >
        {loading ? (
          <span className="btn-loading">
            <span className="spinner-dot" />
            <span className="spinner-dot" />
            <span className="spinner-dot" />
          </span>
        ) : guide ? (
          'Regenerate'
        ) : (
          'Generate Guide'
        )}
      </button>

      {loading && (
        <p className="hint">Calling AI — this may take a few seconds...</p>
      )}

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {guide && (
        <div className="guide-wrap">
          <p className="guide-meta">
            Generated for {guide.ticketKey} ·{' '}
            {new Date(guide.generatedAt).toLocaleTimeString()}
          </p>

          <div className="step-list">
            {guide.steps.map((step) => (
              <StepCard
                key={step.stepNumber}
                step={step}
                expanded={expandedStep === step.stepNumber}
                onToggle={() =>
                  setExpandedStep(
                    expandedStep === step.stepNumber ? null : step.stepNumber
                  )
                }
                onOpenFile={onOpenFile}
              />
            ))}
          </div>

          {!confirmImplement && (
            <button
              className="btn btn-primary"
              onClick={() => setConfirmImplement(true)}
              disabled={implementLoading}
              style={{ marginTop: 8 }}
            >
              {implementLoading ? (
                <span className="btn-loading">
                  <span className="spinner-dot" />
                  <span className="spinner-dot" />
                  <span className="spinner-dot" />
                </span>
              ) : (
                'Implement'
              )}
            </button>
          )}

          {confirmImplement && !implementLoading && (
            <div className="implement-confirm">
              <p className="implement-confirm-text">
                This will modify {guide.steps.length} step{guide.steps.length !== 1 ? 's' : ''} worth of files in your workspace. Continue?
              </p>
              <div className="implement-confirm-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => { setConfirmImplement(false); onImplement(); }}
                >
                  Yes, implement
                </button>
                <button className="btn btn-secondary" onClick={() => setConfirmImplement(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}


          {(implementLoading || implementLog.length > 0) && (
            <ImplementLog lines={implementLog} />
          )}

          {implementError && (
            <div className="error-banner">
              <span className="error-icon">⚠</span>
              <span>{implementError}</span>
            </div>
          )}

          {conflictWarning && conflictWarning.length > 0 && (
            <div className="error-banner">
              <span className="error-icon">⚠</span>
              <span>
                {conflictWarning.length} file{conflictWarning.length !== 1 ? 's' : ''} changed
                since guide was generated:{' '}
                {conflictWarning.join(', ')}. Applied anyway — review carefully.
              </span>
            </div>
          )}

          {implementResult && (
            <LastApplySummary
              diffs={lastAppliedDiffs}
              filesModified={implementResult.filesModified}
              undoLoading={undoLoading}
              undoStatus={undoStatus}
              undoError={undoError}
              onUndo={onUndo}
            />
          )}
        </div>
      )}
    </section>
  );
}

interface StepCardProps {
  step: ImplementationStep;
  expanded: boolean;
  onToggle: () => void;
  onOpenFile: (filePath: string, startLine: number, endLine: number) => void;
}

function StepCard({ step, expanded, onToggle, onOpenFile }: StepCardProps) {
  return (
    <div className="step-card">
      <div className="step-card-header" onClick={onToggle}>
        <span className="step-number">{step.stepNumber}</span>
        <span className="step-title">{step.title}</span>
        <span className="step-chevron">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="step-card-body">
          <p className="step-explanation">{step.explanation}</p>

          {step.fileReferences.length > 0 && (
            <div className="file-refs">
              <p className="file-refs-label">Referenced files</p>
              {step.fileReferences.map((ref, i) => (
                <FileRefRow
                  key={i}
                  ref_={ref}
                  onOpenFile={onOpenFile}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface FileRefRowProps {
  ref_: FileReference;
  onOpenFile: (filePath: string, startLine: number, endLine: number) => void;
}

function FileRefRow({ ref_, onOpenFile }: FileRefRowProps) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div
      className="file-ref"
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="file-ref-row">
        <div className="file-ref-info">
          <span className="file-ref-path">{ref_.filePath}</span>
          <span className="file-ref-lines">
            Lines {ref_.startLine}–{ref_.endLine}
          </span>
        </div>
        <button
          className="btn-link file-ref-open-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOpenFile(ref_.filePath, ref_.startLine, ref_.endLine);
          }}
          title="Open in editor"
        >
          ↗ Open
        </button>
      </div>
      {expanded && ref_.description && (
        <p className="file-ref-desc">{ref_.description}</p>
      )}
      {!expanded && (
        <span className="file-ref-expand-hint">▼</span>
      )}
      {expanded && (
        <span className="file-ref-expand-hint">▲</span>
      )}
    </div>
  );
}

interface LastApplySummaryProps {
  diffs: FileDiff[] | null;
  filesModified: string[];
  undoLoading: boolean;
  undoStatus: string | null;
  undoError: string | null;
  onUndo: () => void;
}

function LastApplySummary({ diffs, filesModified, undoLoading, undoStatus, undoError, onUndo }: LastApplySummaryProps) {
  const [expanded, setExpanded] = useState(false);

  const addCount = diffs?.reduce((sum, d) => sum + d.newCode.split('\n').filter((l) => !d.oldCode.split('\n').includes(l)).length, 0) ?? 0;

  return (
    <div className="last-apply-summary">
      <div className="last-apply-header" onClick={() => setExpanded((v) => !v)}>
        <span className="last-apply-icon">✓</span>
        <span className="last-apply-title">
          Applied {filesModified.length} file{filesModified.length !== 1 ? 's' : ''}
        </span>
        <span className="last-apply-chevron">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && diffs && (
        <div className="last-apply-files">
          {diffs.map((d) => {
            const oldLines = d.oldCode.split('\n');
            const newLines = d.newCode.split('\n');
            const adds = newLines.filter((l) => !oldLines.includes(l)).length;
            const removes = oldLines.filter((l) => !newLines.includes(l)).length;
            return (
              <div key={d.filePath} className="last-apply-file-row">
                <span className="last-apply-file-path">{d.filePath}</span>
                <span className="diff-badge diff-badge--add">+{adds}</span>
                <span className="diff-badge diff-badge--remove">-{removes}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="last-apply-actions">
        <button
          className="btn btn-secondary"
          onClick={onUndo}
          disabled={undoLoading}
        >
          {undoLoading ? 'Undoing…' : '↩ Undo last apply'}
        </button>
      </div>

      {undoStatus && <p className="status-msg">{undoStatus}</p>}
      {undoError && (
        <div className="error-banner">
          <span className="error-icon">⚠</span>
          <span>{undoError}</span>
        </div>
      )}
    </div>
  );
}

function ImplementLog({ lines }: { lines: string[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div className="implement-log">
      {lines.map((line, i) => (
        <div key={i} className="implement-log-line">{line}</div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}