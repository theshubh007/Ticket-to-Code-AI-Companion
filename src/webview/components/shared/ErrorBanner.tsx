import React from 'react';

interface Props {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: Props) {
  return (
    <div className="error-banner">
      <span className="error-icon">⚠</span>
      <span style={{ flex: 1 }}>{message}</span>
      {onDismiss && (
        <button
          className="btn-link"
          onClick={onDismiss}
          style={{ marginLeft: 'auto', flexShrink: 0 }}
        >
          ✕
        </button>
      )}
    </div>
  );
}