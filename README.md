```markdown
<div align="center">

# 🎫 Ticket to Code — AI Companion

**Turn Jira tickets into implementation guides without leaving VS Code.**

[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-85%25-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![OpenAI](https://img.shields.io/badge/Powered%20by-OpenAI-412991?style=flat-square&logo=openai&logoColor=white)](https://openai.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---

## What is Ticket to Code?

Ticket to Code is a VS Code extension that eliminates the constant context-switching between your Jira board and your IDE. Paste a ticket key, and the extension fetches the issue, semantically searches your codebase for the most relevant files, and generates a tailored, step-by-step implementation guide — all grounded in *your actual code*, not generic advice.

No more copy-pasting ticket descriptions. No more guessing which files to touch. Just open the sidebar, enter a ticket, and start coding.

---

## Features

- **🔗 Jira Integration** — Fetch any issue by key (e.g. `PROJ-123`) and instantly pull its summary, description, and acceptance criteria directly into VS Code.

- **🧠 Semantic Code Search** — Your repository is indexed using OpenAI embeddings. When you load a ticket, the engine runs a semantic search to surface the most relevant files and functions — not just keyword matches.

- **🤖 AI-Generated Implementation Guides** — GPT-4o-mini synthesizes your ticket requirements and the relevant code context into a concrete, step-by-step plan tailored to your codebase.

- **🔒 Secure Credential Storage** — Jira tokens and OpenAI API keys are stored using VS Code's built-in `SecretStorage` — never in plaintext or committed to source control.

- **⚡ Incremental Caching** — The code index is cached on disk and updated only when files change, keeping analysis fast even in large repositories.

---

## Demo

> *Screencast / screenshots coming soon.*

---

## Getting Started

### Prerequisites

- VS Code `1.85+`
- Node.js `18+`
- A [Jira API token](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/)
- An [OpenAI API key](https://platform.openai.com/api-keys)

### Installation

**From source (development):**

```bash
git clone https://github.com/theshubh007/Ticket-to-Code-AI-Companion.git
cd Ticket-to-Code-AI-Companion
npm install
npm run dev      # starts watch mode for both extension host and webview
```

Press `F5` in VS Code to launch the **Extension Development Host**.

---

## Configuration

On first launch, the extension will prompt you to enter:

| Setting | Description |
|---|---|
| Jira Base URL | Your Jira instance (e.g. `https://yourorg.atlassian.net`) |
| Jira Email | The email address tied to your Jira account |
| Jira API Token | Generated from your Atlassian account settings |
| OpenAI API Key | Your OpenAI secret key |

All credentials are stored securely via VS Code's `SecretStorage` API.

---

## How It Works

Enter a ticket key in the sidebar and the extension handles the rest in three stages:

```
1. FETCH      →  Pulls the Jira issue (summary, description, acceptance criteria)
2. ANALYZE    →  Indexes your repo with embeddings → finds the most relevant files via cosine similarity
3. GENERATE   →  Sends ticket + code context to GPT-4o-mini → returns a step-by-step implementation guide
```

### Architecture

```
┌──────────────────────────────────────────────────────┐
│                     VS Code Host                      │
│   extension.ts → SidebarProvider → Engine Modules    │
│   TicketManager | CodeAnalyzer | AIEngine | Cache     │
└────────────────────────┬─────────────────────────────┘
                         │  postMessage (bidirectional)
┌────────────────────────▼─────────────────────────────┐
│                WebView UI  (React 18 + TS)            │
│        TicketPanel  |  AnalysisPanel  |  GuidePanel   │
└────────────────────────┬─────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────┐
│                   External APIs                       │
│            Jira REST API  |  OpenAI API               │
└──────────────────────────────────────────────────────┘
```

### Project Structure

```
src/
├── extension/           # Extension host (Node.js / VS Code API)
│   ├── sidebar/         # WebviewViewProvider — registers the sidebar panel
│   ├── engine/          # TicketManager, CodeAnalyzer, AIEngine, CacheManager
│   ├── clients/         # JiraClient, OpenAIClient
│   └── utils/           # chunker, cosine similarity, fileWalker, editorNavigation
└── webview/             # React UI (runs in the browser sandbox)
    ├── components/      # TicketPanel, AnalysisPanel, GuidePanel
    ├── hooks/           # useVsCodeMessages, useExtensionState
    └── styles/          # VS Code theme-aware CSS variables
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Extension Host | TypeScript + esbuild |
| WebView UI | React 18 + TypeScript + Vite |
| Embeddings | OpenAI `text-embedding-3-small` |
| LLM | GPT-4o-mini |
| Vector Store | JSON on disk + cosine similarity |
| Auth | VS Code `SecretStorage` |

---

## Development

```bash
# Install dependencies
npm install

# Watch mode — rebuilds extension + webview on save
npm run dev

# Run tests
npm test
```

Press `F5` to open a new VS Code window with the extension loaded.

---

## Roadmap

- [ ] VS Code Marketplace listing
- [ ] Support for GitHub Issues and Linear
- [ ] Local embedding models (no OpenAI dependency)
- [ ] In-editor code navigation from guide steps
- [ ] Multi-ticket batch analysis

---

## Contributing

Contributions are welcome! Please open an issue to discuss what you'd like to change before submitting a pull request.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a pull request

---

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.

---

<div align="center">

Built with ❤️ to make developers' lives easier.

</div>
```

---

One heads-up: there are nested code fences (` ``` `) inside the block above. When you paste into GitHub's editor, it'll render correctly — but if you're copying from here, make sure the outer triple backticks don't get included. The content starts at `<div align="center">` and ends at `</div>`.
