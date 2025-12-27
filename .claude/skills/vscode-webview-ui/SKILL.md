---
name: vscode-webview-ui
description: Patterns for building React-based VS Code webview panels and sidebars. Covers the postMessage bridge, state persistence, VS Code Webview UI Toolkit components, dark/light theme tokens, and the Vite build setup for webviews. Use when building or modifying the webview (React) side of a VS Code extension, styling components to match VS Code theme, wiring up message handlers, or configuring Vite for the webview bundle. Triggers on mentions of WebviewView, acquireVsCodeApi, postMessage, vscode CSS variables, or webview React.
---

# VS Code Webview UI Patterns

## React Webview Bootstrap

### vite.config.ts (webview build)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/webview',
    rollupOptions: {
      input: resolve(__dirname, 'src/webview/index.html'),
      output: {
        entryFileNames: 'index.js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});
```

### Webview Entry (index.tsx)

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
```

## acquireVsCodeApi Singleton

```typescript
// src/webview/vscodeApi.ts
declare function acquireVsCodeApi<S = unknown>(): {
  postMessage(message: unknown): void;
  getState(): S | undefined;
  setState<T extends S>(state: T): T;
};

// Call exactly once — VS Code throws if called again
let _vscode: ReturnType<typeof acquireVsCodeApi>;

export function getVsCodeApi() {
  if (!_vscode) {
    _vscode = acquireVsCodeApi();
  }
  return _vscode;
}
```

## Typed Message Bus

```typescript
// src/shared/messages.ts  (shared between extension and webview)
export type HostToWebview =
  | { command: 'ticket-loaded'; payload: { id: string; title: string } }
  | { command: 'error'; payload: { message: string } }
  | { command: 'loading'; payload: { loading: boolean } };

export type WebviewToHost =
  | { command: 'fetch-ticket'; payload: { ticketId: string } }
  | { command: 'open-file'; payload: { path: string; line: number } }
  | { command: 'ready' };
```

```typescript
// In React component
import { getVsCodeApi } from '../vscodeApi';
import type { WebviewToHost, HostToWebview } from '../../shared/messages';

const vscode = getVsCodeApi();

// Send to host
function sendMessage(msg: WebviewToHost) {
  vscode.postMessage(msg);
}

// Receive from host
useEffect(() => {
  const handler = (event: MessageEvent<HostToWebview>) => {
    const msg = event.data;
    switch (msg.command) {
      case 'ticket-loaded':
        setTicket(msg.payload);
        break;
      case 'error':
        setError(msg.payload.message);
        break;
    }
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}, []);
```

## VS Code Theme Tokens

VS Code injects CSS variables — use them instead of hardcoded colors:

```css
/* Backgrounds */
background-color: var(--vscode-editor-background);
background-color: var(--vscode-sideBar-background);
background-color: var(--vscode-input-background);

/* Foregrounds */
color: var(--vscode-editor-foreground);
color: var(--vscode-descriptionForeground);
color: var(--vscode-errorForeground);

/* Borders & Dividers */
border-color: var(--vscode-panel-border);
border-color: var(--vscode-input-border);

/* Buttons */
background-color: var(--vscode-button-background);
color: var(--vscode-button-foreground);

/* Highlights */
background-color: var(--vscode-list-activeSelectionBackground);
background-color: var(--vscode-focusBorder);

/* Links */
color: var(--vscode-textLink-foreground);

/* Fonts */
font-family: var(--vscode-font-family);
font-size: var(--vscode-font-size);
font-weight: var(--vscode-font-weight);
```

Using these tokens makes the extension look native in every VS Code theme (dark, light, high contrast).

## State Persistence

Webview state is wiped when the panel becomes hidden. Persist with `setState`/`getState`:

```typescript
const vscode = getVsCodeApi<AppState>();

// Save whenever state changes
function saveState(state: AppState) {
  vscode.setState(state);
}

// Restore on mount
function loadState(): AppState | undefined {
  return vscode.getState();
}

// In App.tsx
const [state, setState] = useState<AppState>(() => loadState() ?? defaultState);
useEffect(() => { saveState(state); }, [state]);
```

## Webview UI Toolkit Components (optional)

```bash
npm install @vscode/webview-ui-toolkit
```

```tsx
import {
  VSCodeButton,
  VSCodeTextField,
  VSCodeProgressRing,
  VSCodeDivider,
  VSCodeBadge,
} from '@vscode/webview-ui-toolkit/react';

function MyPanel() {
  return (
    <div>
      <VSCodeTextField placeholder="Search..." />
      <VSCodeButton onClick={() => sendMessage({ command: 'fetch-ticket', payload: { ticketId: '123' } })}>
        Load Ticket
      </VSCodeButton>
      <VSCodeProgressRing />
      <VSCodeDivider />
      <VSCodeBadge>3</VSCodeBadge>
    </div>
  );
}
```

## Handling React + VS Code Strict Mode

In development, React 18 StrictMode runs effects twice. This can cause double `ready` messages to the host. Handle idempotently in the extension host:

```typescript
// In SidebarProvider
private _isReady = false;
private _handleMessage(msg: WebviewToHost) {
  if (msg.command === 'ready') {
    if (this._isReady) return;  // ignore second call
    this._isReady = true;
    // send initial data
  }
}
```

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `acquireVsCodeApi is not defined` | Running webview outside VS Code | Guard with `typeof acquireVsCodeApi !== 'undefined'` |
| Images not loading | Using file:// paths | Use `webview.asWebviewUri()` in the host |
| Styles don't update on theme switch | Using hardcoded colors | Use `var(--vscode-*)` tokens |
| State lost on panel hide | Not persisting state | Call `vscode.setState()` on every state change |
| Script blocked by CSP | Missing nonce | Add `nonce="${nonce}"` to script tag in HTML template |
