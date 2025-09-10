# Ticket to Code AI Companion

A VS Code extension that bridges your Jira board and your codebase — fetch a ticket, semantically search relevant code, and get an AI-generated implementation guide, all without leaving your editor.

## What it does

1. **Fetch** a Jira issue by key (e.g. `PROJ-123`) — pulls summary, description, and acceptance criteria
2. **Analyze** your repository — indexes files using embeddings and runs semantic search to find the most relevant code
3. **Generate** a step-by-step implementation guide grounded in your actual codebase

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    VS Code Host                      │
│  extension.ts → SidebarProvider → Engine Modules    │
└────────────────────┬────────────────────────────────┘
                     │ postMessage (both directions)
┌────────────────────▼────────────────────────────────┐
│               WebView UI (React + TS)                │
│     TicketPanel | AnalysisPanel | GuidePanel         │
└─────────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│                 External APIs                        │
│         Jira REST API │ OpenAI API                   │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

- **Extension Host**: TypeScript + esbuild
- **WebView UI**: React 18 + TypeScript + Vite
- **Embeddings**: OpenAI `text-embedding-3-small`
- **LLM**: GPT-4o-mini
- **Vector Store**: JSON on disk + cosine similarity (MVP)
- **Auth**: VS Code SecretStorage

## Project Structure

```
src/
├── extension/          # Extension host (Node.js)
│   ├── sidebar/        # WebviewViewProvider
│   ├── engine/         # TicketManager, CodeAnalyzer, AIEngine, CacheManager
│   ├── clients/        # JiraClient, OpenAIClient
│   ├── utils/          # chunker, similarity, fileWalker, editorNavigation
│   └── types/          # Shared types
└── webview/            # React UI (browser)
    ├── components/     # TicketPanel, AnalysisPanel, GuidePanel
    ├── hooks/          # useVsCodeMessages, useExtensionState
    └── styles/         # VS Code theme-aware CSS
```

## Development

```bash
npm install
npm run dev        # watch mode (both extension + webview)
```

Press `F5` in VS Code to launch the Extension Development Host.

## Sprint Timeline

| Sprint | Dates | Focus |
|--------|-------|-------|
| 1 | Sep 1–15 | Repo setup, environment, API access |
| 2 | Sep 16–30 | API clients, extension skeleton |
| 3 | Oct 1–15 | Code analysis engine MVP |
| 4 | Oct 16–31 | AI pipeline POC |
| 5 | Nov 1–15 | WebView UI/UX |
| 6 | Nov 16–30 | E2E, performance, security |
| 7 | Dec 1–8 | User study + fixes |
| 8 | Dec 9–12 | Docs, packaging, submission |
