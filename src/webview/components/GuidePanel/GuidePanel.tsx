import React from 'react';
import { ImplementationGuide } from '../../types';

interface Props {
  guide: ImplementationGuide | null;
  error: string | null;
  loading: boolean;
  disabled: boolean;
  onGenerate: () => void;
  onOpenFile: (filePath: string, startLine: number, endLine: number) => void;
}

export function GuidePanel({
  guide, error, loading, disabled, onGenerate, onOpenFile,
}: Props) {
  return (
    <section className={`panel ${disabled ? 'panel--disabled' : ''}`}>
      <h2>③ Implementation Guide</h2>
      <button
        className="btn btn-primary"
        onClick={onGenerate}
        disabled={disabled || loading}
      >
        {loading ? 'Generating...' : 'Generate Guide'}
      </button>
      {error && <p className="error-msg">{error}</p>}
      {guide && guide.steps.map((step) => (
        <div key={step.stepNumber} className="step-card">
          <p className="step-title">
            {step.stepNumber}. {step.title}
          </p>
          <p className="step-explanation">{step.explanation}</p>
          {step.fileReferences.map((ref, i) => (
            <div
              key={i}
              className="file-ref"
              onClick={() => onOpenFile(ref.filePath, ref.startLine, ref.endLine)}
            >
              <span className="file-ref-path">{ref.filePath}</span>
              <span className="file-ref-lines">:{ref.startLine}–{ref.endLine}</span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}