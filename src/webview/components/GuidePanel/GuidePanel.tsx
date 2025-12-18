import React, { useState, useEffect, useRef } from 'react';
import { ImplementationGuide, ImplementationStep, FileReference } from '../../types';
import { ErrorBanner } from '../shared/ErrorBanner';

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

      {error && <ErrorBanner message={error} />}

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

          <button
            className="btn btn-secondary"
            onClick={onImplement}
            disabled={implementLoading}
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

          {implementError && <ErrorBanner message={implementError} />}

          {implementLog.length > 0 && (
            <ImplementLog
              lines={implementLog}
              loading={implementLoading}
              result={implementResult}
            />
          )}
        </div>
      )}
    </section>
  );
}

interface ImplementLogProps {
  lines: string[];
  loading: boolean;
  result: { filesModified: string[] } | null;
}

function ImplementLog({ lines, loading, result }: ImplementLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div className="implement-log">
      {result && (
        <p className="implement-log-done">
          ✓ Done — {result.filesModified.length} file{result.filesModified.length !== 1 ? 's' : ''} modified
        </p>
      )}
      {lines.map((line, i) => (
        <span key={i} className={`implement-log-line${line.startsWith('▸') ? ' implement-log-step' : ''}`}>
          {line}
        </span>
      ))}
      {loading && (
        <span className="implement-log-line implement-log-cursor" aria-hidden>▌</span>
      )}
      <div ref={bottomRef} />
    </div>
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