import React, { useState, useEffect, useRef } from 'react';
import { ImplementationGuide, ImplementationStep, FileReference, FileDiff } from '../../types';
import { Icon } from '../shared/Icon';
import { Button, Note } from '../shared/ui';

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

/** Step-by-step plan for the ticket, shown inside the "Implementation guide" disclosure. */
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
    <div className="stack">
      {disabled && !guide && (
        <p className="card-status">Search the workspace under Related code first, so the guide can point at real files.</p>
      )}

      <Button variant="secondary" block icon="list" onClick={onGenerate} disabled={disabled} loading={loading}>
        {guide ? 'Write a new guide' : 'Write guide'}
      </Button>

      {loading && <p className="card-status">Writing the guide. This can take a few seconds…</p>}
      {error && <Note tone="error">{error}</Note>}

      {guide && (
        <>
          <p className="card-footnote">
            {guide.steps.length} steps · {new Date(guide.generatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </p>

          <ol className="group group--nested guide-steps">
            {guide.steps.map((step) => (
              <StepRow
                key={step.stepNumber}
                step={step}
                expanded={expandedStep === step.stepNumber}
                onToggle={() => setExpandedStep(expandedStep === step.stepNumber ? null : step.stepNumber)}
                onOpenFile={onOpenFile}
              />
            ))}
          </ol>

          {!confirmImplement && !implementResult && (
            <Button variant="secondary" block onClick={() => setConfirmImplement(true)} loading={implementLoading}>
              Implement all steps
            </Button>
          )}

          {confirmImplement && !implementLoading && (
            <Note
              tone="warning"
              title="Implement every step?"
              action={
                <div className="button-row">
                  <Button variant="secondary" size="small" onClick={() => setConfirmImplement(false)}>Cancel</Button>
                  <Button variant="primary" size="small" onClick={() => { setConfirmImplement(false); onImplement(); }}>
                    Implement
                  </Button>
                </div>
              }
            >
              The assistant edits the files named in all {guide.steps.length} steps. You review the diffs before anything is saved.
            </Note>
          )}

          {(implementLoading || implementLog.length > 0) && <ImplementLog lines={implementLog} />}
          {implementError && <Note tone="error">{implementError}</Note>}

          {conflictWarning && conflictWarning.length > 0 && (
            <Note tone="warning" title="Files changed after the guide was written">
              {conflictWarning.join(', ')} changed since the guide was generated. The edits were applied anyway, so review them carefully.
            </Note>
          )}

          {implementResult && (
            <LastApplySummary
              diffs={lastAppliedDiffs}
              filesModified={implementResult.filesModified}
              undoLoading={undoLoading}
              onUndo={onUndo}
            />
          )}
          {undoStatus && <Note tone="success">{undoStatus}</Note>}
          {undoError && <Note tone="error">{undoError}</Note>}
        </>
      )}
    </div>
  );
}

function StepRow({
  step,
  expanded,
  onToggle,
  onOpenFile,
}: {
  step: ImplementationStep;
  expanded: boolean;
  onToggle: () => void;
  onOpenFile: (filePath: string, startLine: number, endLine: number) => void;
}) {
  return (
    <li className="guide-step">
      <button type="button" className="guide-step-header" aria-expanded={expanded} onClick={onToggle}>
        <span className="guide-step-number">{step.stepNumber}</span>
        <span className="guide-step-title">{step.title}</span>
        <Icon name="chevronRight" size={12} className={`snippet-chevron${expanded ? ' snippet-chevron--open' : ''}`} />
      </button>
      {expanded && (
        <div className="guide-step-body">
          <p className="body-text">{step.explanation}</p>
          {step.fileReferences.map((ref, i) => (
            <FileRefRow key={i} fileRef={ref} onOpenFile={onOpenFile} />
          ))}
        </div>
      )}
    </li>
  );
}

function FileRefRow({
  fileRef,
  onOpenFile,
}: {
  fileRef: FileReference;
  onOpenFile: (filePath: string, startLine: number, endLine: number) => void;
}) {
  return (
    <button
      type="button"
      className="file-ref"
      onClick={() => onOpenFile(fileRef.filePath, fileRef.startLine, fileRef.endLine)}
      title={fileRef.description || `Open ${fileRef.filePath}`}
    >
      <Icon name="fileCode" size={13} />
      <span className="file-row-text">
        <span className="file-row-name">{fileRef.filePath.split('/').pop()}</span>
        <span className="file-row-dir">Lines {fileRef.startLine}–{fileRef.endLine}</span>
      </span>
      <Icon name="external" size={12} className="row-chevron" />
    </button>
  );
}

function LastApplySummary({
  diffs,
  filesModified,
  undoLoading,
  onUndo,
}: {
  diffs: FileDiff[] | null;
  filesModified: string[];
  undoLoading: boolean;
  onUndo: () => void;
}) {
  return (
    <Note
      tone="success"
      title={`Applied ${filesModified.length} file${filesModified.length !== 1 ? 's' : ''}`}
      action={<Button variant="plain" size="small" icon="undo" onClick={onUndo} loading={undoLoading}>Undo</Button>}
    >
      {diffs && (
        <ul className="applied-files">
          {diffs.map((d) => {
            const oldLines = d.oldCode.split('\n');
            const newLines = d.newCode.split('\n');
            const adds = newLines.filter((l) => !oldLines.includes(l)).length;
            const removes = oldLines.filter((l) => !newLines.includes(l)).length;
            return (
              <li key={d.filePath} title={d.filePath}>
                <span className="applied-file-name">{d.filePath.split('/').pop()}</span>
                <span className="diffstat diffstat--add">+{adds}</span>
                <span className="diffstat diffstat--remove">−{removes}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Note>
  );
}

function ImplementLog({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);
  return (
    <pre ref={ref} className="console console--short" aria-label="Implementation log" aria-live="polite">
      {lines.join('\n') || 'Starting…'}
    </pre>
  );
}
