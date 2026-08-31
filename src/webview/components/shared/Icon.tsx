import React from 'react';

/** Stroke icons drawn on a 16px grid, sized to sit on the text baseline. */
const PATHS = {
  chevronLeft: <path d="M10 3.5 5.5 8l4.5 4.5" />,
  chevronRight: <path d="M6 3.5 10.5 8 6 12.5" />,
  chevronDown: <path d="M3.5 6 8 10.5 12.5 6" />,
  search: <><circle cx="7" cy="7" r="4.25" /><path d="m10.25 10.25 3.25 3.25" /></>,
  refresh: <><path d="M13 8a5 5 0 1 1-1.46-3.54" /><path d="M13 2.75V5.5h-2.75" /></>,
  gear: (
    <g transform="scale(0.6667)" strokeWidth="2.1">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </g>
  ),
  check: <path d="m3.5 8.5 3 3 6-7" />,
  checkCircle: <><circle cx="8" cy="8" r="6.25" /><path d="m5.5 8.25 1.75 1.75 3.25-3.75" /></>,
  circle: <circle cx="8" cy="8" r="6.25" />,
  xCircle: <><circle cx="8" cy="8" r="6.25" /><path d="m6 6 4 4M10 6l-4 4" /></>,
  x: <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />,
  alert: <><path d="M8 2.25 14.25 13.5H1.75L8 2.25Z" /><path d="M8 6.5v3M8 11.5v.01" /></>,
  info: <><circle cx="8" cy="8" r="6.25" /><path d="M8 7.25v3.5M8 5.25v.01" /></>,
  sparkle: <path d="M8 1.75c.4 2.9 1.35 3.85 4.25 4.25C9.35 6.4 8.4 7.35 8 10.25 7.6 7.35 6.65 6.4 3.75 6 6.65 5.6 7.6 4.65 8 1.75ZM12 10.5c.2 1.3.7 1.8 2 2-1.3.2-1.8.7-2 2-.2-1.3-.7-1.8-2-2 1.3-.2 1.8-.7 2-2Z" />,
  play: <path d="M5 3.25v9.5L12.5 8 5 3.25Z" />,
  stop: <rect x="4" y="4" width="8" height="8" rx="1.25" />,
  file: <><path d="M4 1.75h5L12.25 5v9.25H4V1.75Z" /><path d="M9 1.75V5h3.25" /></>,
  fileCode: <><path d="M4 1.75h5L12.25 5v9.25H4V1.75Z" /><path d="M9 1.75V5h3.25M7 8.25 5.75 9.5 7 10.75M9.25 8.25l1.25 1.25-1.25 1.25" /></>,
  flask: <><path d="M6.25 1.75v4L2.75 12.5a1.25 1.25 0 0 0 1.1 1.75h8.3a1.25 1.25 0 0 0 1.1-1.75L9.75 5.75v-4" /><path d="M5.25 1.75h5.5M4.25 10h7.5" /></>,
  wrench: <path d="M10.5 1.9a3.5 3.5 0 0 0-3.15 4.85L2.3 11.8a1.3 1.3 0 0 0 1.84 1.84L9.2 8.6A3.5 3.5 0 0 0 14 5.5l-2.1 2.1-2.15-.35-.35-2.15 2.1-2.1a3.5 3.5 0 0 0-1-1.1Z" />,
  tray: <><path d="M1.75 9.25 3.5 3.25h9l1.75 6v4H1.75v-4Z" /><path d="M1.75 9.25h3.5l.75 1.5h4l.75-1.5h3.5" /></>,
  key: <><circle cx="5.25" cy="10.75" r="2.75" /><path d="m7.25 8.75 6-6M11.25 4.75l1.5 1.5M9.75 6.25l1.25 1.25" /></>,
  code: <path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" />,
  list: <path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" />,
  external: <><path d="M9.25 2.25h4.5v4.5M13.5 2.5 7.5 8.5" /><path d="M12 9.5v3.25a1 1 0 0 1-1 1H3.25a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1H6.5" /></>,
  undo: <><path d="M5.5 3.5 2.5 6.5l3 3" /><path d="M2.75 6.5h6.75a4 4 0 0 1 0 8H7" /></>,
  bug: <><rect x="4.75" y="4.5" width="6.5" height="9" rx="3.25" /><path d="M6 4.75a2 2 0 0 1 4 0M8 7.5v6M4.75 8.75H2M14 8.75h-2.75M4.9 6.25 3 5M11.1 6.25 13 5M4.9 11.25 3 12.5M11.1 11.25 13 12.5" /></>,
  bookmark: <path d="M4.25 2.25h7.5v11.5L8 11l-3.75 2.75V2.25Z" />,
  taskSquare: <><rect x="2.25" y="2.25" width="11.5" height="11.5" rx="2.5" /><path d="m5.25 8.25 2 2 3.75-4.25" /></>,
  bolt: <path d="M9 1.75 3.5 9h4l-.5 5.25L12.5 7h-4L9 1.75Z" />,
  arrowUp: <path d="M8 13V3.5M4 7.25 8 3.25l4 4" />,
  arrowDown: <path d="M8 3v9.5M4 8.75l4 4 4-4" />,
  equals: <path d="M3.5 6.25h9M3.5 9.75h9" />,
  message: <path d="M3.75 2.75h8.5a1.5 1.5 0 0 1 1.5 1.5v5.5a1.5 1.5 0 0 1-1.5 1.5H7.5l-3 2.5v-2.5h-.75a1.5 1.5 0 0 1-1.5-1.5v-5.5a1.5 1.5 0 0 1 1.5-1.5Z" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  const filled = name === 'play' || name === 'stop' || name === 'sparkle' || name === 'bolt';
  return (
    <svg
      className={`icon${className ? ' ' + className : ''}`}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
