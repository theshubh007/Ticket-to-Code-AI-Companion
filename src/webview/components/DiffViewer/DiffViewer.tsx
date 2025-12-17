import React from 'react';
import { FileDiff } from '../../types';
import { Button } from '../shared/Button';
import './DiffViewer.css';

interface DiffViewerProps {
  diffs: FileDiff[];
  onAccept: (filePath: string) => void;
  onReject: (filePath: string) => void;
  onAcceptAll: () => void;
  onCancel: () => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  diffs,
  onAccept,
  onReject,
  onAcceptAll,
  onCancel,
}) => {
  if (diffs.length === 0) {
    return (
      <div className="diff-viewer">
        <h3>No changes detected.</h3>
        <Button onClick={onCancel}>Back</Button>
      </div>
    );
  }

  return (
    <div className="diff-viewer">
      <h3>Review Changes</h3>
      <p>Review the proposed changes before applying them to your workspace.</p>

      {diffs.map((diff) => (
        <FileDiffItem
          key={diff.filePath}
          diff={diff}
          onAccept={() => onAccept(diff.filePath)}
          onReject={() => onReject(diff.filePath)}
        />
      ))}

      <div className="diff-footer">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onAcceptAll}>Accept All</Button>
      </div>
    </div>
  );
};

const FileDiffItem: React.FC<{
  diff: FileDiff;
  onAccept: () => void;
  onReject: () => void;
}> = ({ diff, onAccept, onReject }) => {
  const oldLines = diff.oldCode.split('\n');
  const newLines = diff.newCode.split('\n');
  const maxLines = Math.max(oldLines.length, newLines.length);

  return (
    <div className="diff-file">
      <div className="diff-file-header">
        <span className="diff-file-path">{diff.filePath}</span>
        <div className="diff-actions">
          <Button variant="secondary" onClick={onReject}>
            Reject
          </Button>
          <Button onClick={onAccept}>Accept</Button>
        </div>
      </div>
      <div className="diff-content">
        <div className="diff-column">
          {oldLines.map((line, i) => (
            <div
              key={`old-${i}`}
              className={`diff-line ${
                i < newLines.length && line !== newLines[i] ? 'removed' : ''
              }`}
            >
              <span className="line-number">{i + 1}</span>
              <span className="line-content">{line}</span>
            </div>
          ))}
          {Array.from({ length: Math.max(0, newLines.length - oldLines.length) }).map(
            (_, i) => (
              <div key={`old-empty-${i}`} className="diff-line empty">
                <span className="line-number"></span>
                <span className="line-content"></span>
              </div>
            )
          )}
        </div>
        <div className="diff-column">
          {newLines.map((line, i) => (
            <div
              key={`new-${i}`}
              className={`diff-line ${
                i < oldLines.length && line !== oldLines[i] ? 'added' : ''
              }${i >= oldLines.length ? 'added' : ''}`}
            >
              <span className="line-number">{i + 1}</span>
              <span className="line-content">{line}</span>
            </div>
          ))}
          {Array.from({ length: Math.max(0, oldLines.length - newLines.length) }).map(
            (_, i) => (
              <div key={`new-empty-${i}`} className="diff-line empty">
                <span className="line-number"></span>
                <span className="line-content"></span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
