---
name: typescript-extension-patterns
description: TypeScript patterns for VS Code extension development — strict typing, discriminated unions for message passing, generic caching, error handling hierarchies, and esbuild/tsconfig setup. Use when writing TypeScript code in a VS Code extension, designing message protocol types, setting up tsconfig for dual extension+webview builds, or solving TypeScript-specific extension issues. Triggers on TypeScript compile errors, type narrowing questions, or tsconfig questions in an extension project.
---

# TypeScript Patterns for VS Code Extensions

## tsconfig Setup (Dual Build)

Extensions need two separate TypeScript configs — one for the Node.js extension host, one for the browser-like webview.

### tsconfig.extension.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "outDir": "dist/extension",
    "rootDir": "src/extension",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/extension/**/*"],
  "exclude": ["node_modules", "src/webview"]
}
```

### tsconfig.webview.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/webview/*"] }
  },
  "include": ["src/webview/**/*"],
  "exclude": ["node_modules", "src/extension"]
}
```

## Discriminated Unions for Messages

Use discriminated unions for the postMessage protocol — TypeScript narrows the type automatically:

```typescript
// src/shared/messages.ts
export type HostToWebview =
  | { command: 'state-update'; payload: AppState }
  | { command: 'ticket-loaded'; payload: Ticket }
  | { command: 'error'; payload: { message: string; code?: string } }
  | { command: 'loading'; payload: { loading: boolean } }
  | { command: 'file-opened'; payload: { path: string; line: number } };

export type WebviewToHost =
  | { command: 'ready' }
  | { command: 'fetch-ticket'; payload: { ticketId: string } }
  | { command: 'open-file'; payload: { path: string; line: number } }
  | { command: 'reset-credentials' }
  | { command: 'set-model'; payload: { model: string } };
```

```typescript
// In the extension host — TypeScript narrows on command
function handleMessage(msg: WebviewToHost) {
  switch (msg.command) {
    case 'fetch-ticket':
      // msg.payload is { ticketId: string } — fully typed
      return fetchTicket(msg.payload.ticketId);
    case 'open-file':
      return openFile(msg.payload.path, msg.payload.line);
    case 'ready':
      return sendInitialState();
  }
}
```

## Generic Cache with TTL

```typescript
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class TypedCache<T> {
  private readonly cache = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Usage
const modelCache = new TypedCache<string[]>(60 * 60 * 1000); // 1-hour TTL
```

## Error Hierarchy

```typescript
export class ExtensionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ExtensionError';
  }
}

export class AuthError extends ExtensionError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthError';
  }
}

export class ApiError extends ExtensionError {
  constructor(message: string, public readonly statusCode: number) {
    super(message, 'API_ERROR');
    this.name = 'ApiError';
  }
}

// Narrowing in catch blocks
function handleError(err: unknown): string {
  if (err instanceof AuthError) return `Auth failed: ${err.message}`;
  if (err instanceof ApiError) return `API error ${err.statusCode}: ${err.message}`;
  if (err instanceof ExtensionError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}
```

## Result Type (no exceptions for control flow)

```typescript
type Ok<T> = { ok: true; value: T };
type Err<E> = { ok: false; error: E };
type Result<T, E = Error> = Ok<T> | Err<E>;

const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
const err = <E>(error: E): Err<E> => ({ ok: false, error });

// Usage
async function fetchTicket(id: string): Promise<Result<Ticket>> {
  try {
    const ticket = await jiraClient.getTicket(id);
    return ok(ticket);
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

const result = await fetchTicket('PROJ-123');
if (!result.ok) {
  vscode.window.showErrorMessage(result.error.message);
  return;
}
const ticket = result.value; // fully typed Ticket
```

## Type-Safe Configuration

```typescript
interface ExtensionConfig {
  jiraUrl: string;
  model: string;
  maxResults: number;
  enableDebug: boolean;
}

function getConfig(): ExtensionConfig {
  const cfg = vscode.workspace.getConfiguration('ticket-to-code');
  return {
    jiraUrl: cfg.get<string>('jiraUrl', ''),
    model: cfg.get<string>('model', 'openai/gpt-4o'),
    maxResults: cfg.get<number>('maxResults', 10),
    enableDebug: cfg.get<boolean>('enableDebug', false),
  };
}
```

## esbuild Config for Extension Host

```js
// esbuild.config.mjs
import esbuild from 'esbuild';

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: ['src/extension/extension.ts'],
  bundle: true,
  format: 'cjs',
  minify: isProduction,
  sourcemap: !isProduction,
  sourcesContent: false,
  platform: 'node',
  outfile: 'dist/extension/extension.js',
  external: ['vscode'],  // CRITICAL: never bundle vscode
  logLevel: 'silent',
});

if (isWatch) {
  await ctx.watch();
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
```

The `external: ['vscode']` line is essential — VS Code provides the `vscode` module at runtime and it must not be bundled.
