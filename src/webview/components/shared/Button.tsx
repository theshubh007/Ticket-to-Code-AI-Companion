import React from 'react';

interface Props {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}

export function Button({
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary',
  children,
}: Props) {
  return (
    <button
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <span className="btn-loading">
          <span className="spinner-dot" />
          <span className="spinner-dot" />
          <span className="spinner-dot" />
        </span>
      ) : (
        children
      )}
    </button>
  );
}