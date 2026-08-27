import React, { useId, useState } from 'react';
import { Icon, IconName } from './Icon';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'plain' | 'destructive';
  size?: 'regular' | 'small';
  block?: boolean;
  icon?: IconName;
  loading?: boolean;
};

export function Button({
  variant = 'secondary',
  size = 'regular',
  block = false,
  icon,
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = ['btn', `btn--${variant}`, size === 'small' && 'btn--small', block && 'btn--block', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <ActivityIndicator size={14} /> : icon && <Icon name={icon} size={size === 'small' ? 13 : 14} />}
      <span>{children}</span>
    </button>
  );
}

export function IconButton({
  icon,
  label,
  spinning = false,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; spinning?: boolean }) {
  return (
    <button
      type="button"
      className={`icon-btn${spinning ? ' icon-btn--spinning' : ''}${className ? ' ' + className : ''}`}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}

/** Indeterminate spinner, in the style of the system activity indicator. */
export function ActivityIndicator({ size = 16, label }: { size?: number; label?: string }) {
  return (
    <span className="activity" style={{ width: size, height: size }} role={label ? 'status' : undefined} aria-label={label}>
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} style={{ transform: `rotate(${i * 45}deg)`, animationDelay: `${(i - 8) * 0.1}s` }} />
      ))}
    </span>
  );
}

export function ProgressBar({ label }: { label: string }) {
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-busy="true">
      <span />
    </div>
  );
}

const NOTE_ICONS: Record<NoteTone, IconName> = {
  info: 'info',
  success: 'checkCircle',
  warning: 'alert',
  error: 'xCircle',
};
type NoteTone = 'info' | 'success' | 'warning' | 'error';

/** A short inline message with an icon. Errors are announced to screen readers. */
export function Note({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: NoteTone;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className={`note note--${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon name={NOTE_ICONS[tone]} className="note-icon" />
      <div className="note-body">
        {title && <p className="note-title">{title}</p>}
        {children && <div className="note-text">{children}</div>}
        {action && <div className="note-action">{action}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: IconName;
  title: string;
  message?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={22} /></span>
      <p className="empty-title">{title}</p>
      {message && <p className="empty-message">{message}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

/** Top bar for a screen: a back button and/or title on the left, actions on the right. */
export function NavBar({
  backLabel,
  onBack,
  title,
  children,
}: {
  backLabel?: string;
  onBack?: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="navbar">
      {onBack && (
        <button type="button" className="navbar-back" onClick={onBack}>
          <Icon name="chevronLeft" />
          <span>{backLabel ?? 'Back'}</span>
        </button>
      )}
      {title && <h1 className="navbar-title">{title}</h1>}
      <div className="navbar-actions">{children}</div>
    </header>
  );
}

/** Collapsible group. The header is a real button so it works from the keyboard. */
export function Disclosure({
  title,
  subtitle,
  icon,
  defaultOpen = false,
  accessory,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  defaultOpen?: boolean;
  accessory?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={`disclosure${open ? ' disclosure--open' : ''}`}>
      <button
        type="button"
        className="disclosure-header"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        {icon && <span className="disclosure-icon"><Icon name={icon} /></span>}
        <span className="disclosure-text">
          <span className="disclosure-title">{title}</span>
          {subtitle && <span className="disclosure-subtitle">{subtitle}</span>}
        </span>
        {accessory}
        <Icon name="chevronRight" className="disclosure-chevron" />
      </button>
      {open && (
        <div className="disclosure-content" id={id}>
          {children}
        </div>
      )}
    </div>
  );
}

export function Skeleton({ width = '100%', height = 10 }: { width?: number | string; height?: number }) {
  return <span className="skeleton" style={{ width, height }} aria-hidden="true" />;
}

export function SectionHeading({ children, trailing }: { children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div className="section-heading">
      <h2>{children}</h2>
      {trailing}
    </div>
  );
}
