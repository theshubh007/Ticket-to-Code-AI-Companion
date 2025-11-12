import React from 'react';

interface Props {
  number: string;
  title: string;
  badge?: string;
  badgeVariant?: 'success' | 'warning' | 'default';
}

export function SectionHeader({ number, title, badge, badgeVariant = 'default' }: Props) {
  return (
    <div className="panel-header">
      <span className="panel-number">{number}</span>
      <h2 className="panel-title">{title}</h2>
      {badge && (
        <span className={`panel-badge ${badgeVariant === 'success' ? 'success' : ''}`}>
          {badge}
        </span>
      )}
    </div>
  );
}