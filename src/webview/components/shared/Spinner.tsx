import React from 'react';

export function Spinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="spinner-wrap">
      <span className="btn-loading">
        <span className="spinner-dot" />
        <span className="spinner-dot" />
        <span className="spinner-dot" />
      </span>
      {label && <p className="hint">{label}</p>}
    </div>
  );
}