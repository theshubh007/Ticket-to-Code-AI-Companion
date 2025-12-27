---
name: vscode-extension
description: Use when developing VS Code extensions — covers extension architecture, package.json manifest, activation events, command registration, language support, LSP integration, SecretStorage, and packaging/publishing. Trigger when the user asks about VS Code extension structure, contributes points, activation, vsce, or adding commands/views.
---

# VS Code Extension Development

## Quick Start

```json
// package.json
{
  "name": "my-extension",
  "displayName": "My Extension",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "activationEvents": ["onStartupFinished"],
  "main": "./dist/extension/extension.js",
  "contributes": {
    "commands": [
      { "command": "my-ext.hello", "title": "My Extension: Hello" }
    ],
    "configuration": {
      "title": "My Extension",
      "properties": {
        "myExt.apiKey": { "type": "string", "description": "API key" }
      }
    }
  }
}
```

## Activation Events

Use specific triggers — never `"*"` (activates on every VS Code startup):

```json
"activationEvents": [
  "onLanguage:typescript",
  "onCommand:my-ext.hello",
  "onView:my-ext.sidebar",
  "workspaceContains:**/.myconfig",
  "onStartupFinished"
]
```

## Extension Entry Point

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('my-ext.hello', () => {
      vscode.window.showInformationMessage('Hello from My Extension!');
    })
  );
}

export function deactivate() {}
```

## Core API Namespaces

```typescript
// Window API
vscode.window.showInformationMessage('Info');
vscode.window.showErrorMessage('Error');
vscode.window.showInputBox({ prompt: 'Enter value' });
vscode.window.showQuickPick(['a', 'b'], { placeHolder: 'Choose' });

// Workspace API
const config = vscode.workspace.getConfiguration('my-ext');
const value = config.get<string>('apiKey');
vscode.workspace.onDidChangeTextDocument(e => { /* handle */ });

// Commands API
vscode.commands.executeCommand('workbench.action.reloadWindow');
```

## Secure Credential Storage

Use `SecretStorage` for API keys — never `globalState` or plain config:

```typescript
// Store
await context.secrets.store('apiKey', value);

// Retrieve
const key = await context.secrets.get('apiKey');

// Delete
await context.secrets.delete('apiKey');
```

## Language Configuration

```json
// language-configuration.json
{
  "comments": { "lineComment": "--" },
  "brackets": [["{", "}"], ["[", "]"], ["(", ")"]],
  "autoClosingPairs": [
    { "open": "{", "close": "}" },
    { "open": "[", "close": "]" },
    { "open": "(", "close": ")" },
    { "open": "\"", "close": "\"" }
  ]
}
```

## LSP Client Integration

```typescript
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

export function activate(context: vscode.ExtensionContext) {
  const serverModule = context.asAbsolutePath('server/index.js');

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'typescript' }],
  };

  const client = new LanguageClient('my-lsp', 'My Language Server', serverOptions, clientOptions);
  client.start();
  context.subscriptions.push(client);
}
```

## TreeView Provider

```typescript
class MyTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }
  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (!element) {
      return [new vscode.TreeItem('Item 1'), new vscode.TreeItem('Item 2')];
    }
    return [];
  }
}

// Register in package.json contributes.views, then:
context.subscriptions.push(
  vscode.window.registerTreeDataProvider('my-ext.treeView', new MyTreeProvider())
);
```

## Snippets

```json
// snippets/my-lang.json
{
  "Function": {
    "prefix": "fn",
    "body": ["function ${1:name}(${2:params}) {", "  ${0}", "}"],
    "description": "Define a function"
  }
}
```

## Packaging & Publishing

```bash
# Install vsce globally
npm install -g @vscode/vsce

# Package to .vsix
vsce package

# Publish to Marketplace (requires publisher login)
vsce publish

# Check what's included
vsce ls
```

## .vscodeignore

```
src/
**/*.ts
!dist/**
node_modules/
.vscode-test/
**/*.map
```

## Common Pitfalls

- **Never use `*` activation** — it slows VS Code startup for all users
- **Dispose all subscriptions** — push to `context.subscriptions` or call `.dispose()` in `deactivate()`
- **No synchronous I/O on activation** — defer heavy work to command handlers
- **Use `context.asAbsolutePath()`** for bundled asset paths, not `__dirname`
- **Handle missing workspace** — `vscode.workspace.workspaceFolders` can be undefined
