import React, { useState, useEffect, useRef } from 'react';
import { ImplementationGuide, ImplementationStep, FileReference } from '../../types';

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

          {implementResult && (
            <div className="success-banner">
              Applied {implementResult.filesModified.length} file
              {implementResult.filesModified.length !== 1 ? 's' : ''}:{' '}
              {implementResult.filesModified.join(', ')}
            </div>
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
  return (
    <div
      className="file-ref"
      onClick={() => onOpenFile(ref_.filePath, ref_.startLine, ref_.endLine)}
      title={ref_.description}
    >
      <span className="file-ref-icon">↗</span>
      <div className="file-ref-info">
        <span className="file-ref-path">{ref_.filePath}</span>
        <span className="file-ref-lines">
          Lines {ref_.startLine}–{ref_.endLine}
        </span>
      </div>
      {ref_.description && (
        <p className="file-ref-desc">{ref_.description}</p>
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