---
name: vscode-extension-expert
description: Expert-level guidance for VS Code extension development covering WebView panels, Content Security Policy, postMessage bridge, Language Server Protocol, performance optimization, security checklist, and Marketplace publishing requirements. Use when implementing WebViews, designing extension architecture, building sidebar panels, debugging CSP issues, or preparing extensions for production. Triggers on mentions of VS Code API, SidebarProvider, WebviewPanel, CSP, postMessage, vsce publish, or extension performance.
---

# VS Code Extension Expert Guide

## Extension Architecture

```
my-extension/
├── package.json          # Manifest: commands, views, config contributions
├── src/
│   ├── extension.ts      # activate() / deactivate() entry point
│   ├── sidebar/
│   │   └── SidebarProvider.ts  # WebviewViewProvider implementation
│   ├── engine/           # Core business logic (no VS Code deps here)
│   └── utils/            # Pure utility functions
├── webview-src/          # React/Vue/Vanilla UI source
│   └── App.tsx
├── dist/                 # Bundled output (committed in .vsix)
│   ├── extension/
│   └── webview/
└── media/                # Static assets (icons, CSS)
```

Keep VS Code API calls isolated in `extension.ts` and providers. Pure logic in `engine/` is testable without VS Code mocks.

## WebView Development

### SidebarProvider (WebviewViewProvider)

```typescript
import * as vscode from 'vscode';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'my-ext.sidebar';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlContent(webviewView.webview);

    // Host → Webview
    webviewView.webview.onDidReceiveMessage(this._handleMessage, this);
  }

  // Webview → Host
  private _handleMessage(message: { command: string; payload?: unknown }) {
    switch (message.command) {
      case 'fetch-data':
        // do work, then reply
        this._view?.webview.postMessage({ command: 'data-ready', payload: {} });
        break;
    }
  }

  private _getHtmlContent(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'index.js')
    );
    const nonce = getNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             script-src 'nonce-${nonce}';
             style-src ${webview.cspSource} 'unsafe-inline';
             img-src ${webview.cspSource} https: data:;
             connect-src https:;" />
  <title>My Extension</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
```

### React Webview Side (postMessage)

```typescript
// In your React app (webview-src/vscodeApi.ts)
declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

// Send to host
vscode.postMessage({ command: 'fetch-data', payload: { ticketId: '123' } });

// Receive from host
window.addEventListener('message', (event) => {
  const message = event.data as { command: string; payload?: unknown };
  switch (message.command) {
    case 'data-ready':
      // update React state
      break;
  }
});
```

## Content Security Policy (CSP)

**Always implement strict CSP** — it prevents XSS in webviews:

| Directive | Purpose |
|-----------|---------|
| `default-src 'none'` | Block everything by default |
| `script-src 'nonce-${nonce}'` | Only allow nonce-tagged scripts |
| `style-src ${webview.cspSource} 'unsafe-inline'` | Allow bundled + inline styles |
| `connect-src https:` | Allow fetch/XHR to HTTPS APIs |
| `img-src ${webview.cspSource} https: data:` | Allow webview + remote images |

Never use `script-src 'unsafe-eval'` or `script-src *`.

## Performance Optimization

```typescript
// Lazy-load heavy dependencies
export function activate(context: vscode.ExtensionContext) {
  // Register command handler — don't import heavy modules yet
  context.subscriptions.push(
    vscode.commands.registerCommand('my-ext.analyze', async () => {
      // Import only when the command runs
      const { CodeAnalyzer } = await import('./engine/CodeAnalyzer');
      const analyzer = new CodeAnalyzer();
      await analyzer.run();
    })
  );
}
```

Use `esbuild` or `webpack` to bundle — don't ship `node_modules/` in your extension.

## Testing Strategy

```bash
# Unit tests (no VS Code runtime needed)
npm run test:unit

# Integration tests (launches VS Code)
npx @vscode/test-cli --config .vscode-test.mjs
```

```typescript
// Mock VS Code in unit tests
jest.mock('vscode', () => ({
  window: { showInformationMessage: jest.fn() },
  workspace: { getConfiguration: jest.fn(() => ({ get: jest.fn() })) },
  commands: { registerCommand: jest.fn() },
  Uri: { joinPath: jest.fn(), file: jest.fn() },
}), { virtual: true });
```

## Security Checklist

- [ ] CSP set with nonce on every `<script>` tag
- [ ] API keys stored in `context.secrets`, never in `globalState`
- [ ] User input sanitized before use in commands or file paths
- [ ] `localResourceRoots` restricted to extension URI only
- [ ] No `eval()` or `Function()` in webview scripts
- [ ] HTTPS-only for all external API calls

## Publishing Requirements

```json
// package.json required fields for Marketplace
{
  "publisher": "your-publisher-id",
  "name": "my-extension",
  "displayName": "My Extension",
  "description": "One clear sentence what this does",
  "version": "1.0.0",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "repository": { "type": "git", "url": "https://github.com/you/repo" },
  "license": "MIT",
  "icon": "media/icon.png"
}
```

```bash
# Login once
vsce login your-publisher-id

# Bump version + publish
vsce publish minor

# Or patch / major
vsce publish patch
vsce publish 2.0.0
```

Icon must be 128×128 PNG. Add a `README.md` with screenshots — it becomes the Marketplace page.

## Common Pitfalls

| Problem | Fix |
|---------|-----|
| Webview blank after reload | Persist state with `vscode.setState()` / `vscode.getState()` |
| CSP blocks scripts | Add `nonce` attribute to every `<script>` tag |
| Extension slow to start | Move work behind commands; use `onStartupFinished` sparingly |
| Assets 404 in webview | Use `webview.asWebviewUri()` — never raw file paths |
| Tests fail to find `vscode` | Add `moduleNameMapper` in jest config to mock `vscode` |
