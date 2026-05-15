<div align="center">

# Ticket to Code Orchestrator

**Turn assigned Jira tickets into code-aware implementation guides and reviewable edits without leaving VS Code.**

![VS Code 1.85+](https://img.shields.io/badge/VS%20Code-1.85%2B-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/yugm-patel-1312.ticket-to-code-ai-companion?style=flat-square&label=Marketplace&logo=visualstudiocode&logoColor=white&color=007ACC)](https://marketplace.visualstudio.com/items?itemName=yugm-patel-1312.ticket-to-code-ai-companion)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=111111)
![OpenRouter](https://img.shields.io/badge/AI-OpenRouter-111827?style=flat-square)

</div>

---

## What Is Ticket To Code Orchestrator?

Ticket to Code Orchestrator is a VS Code extension that connects your Jira
tickets, local repository, and AI model into one guided implementation flow.
Open the sidebar, load your assigned Jira tickets, select one, analyze the
current workspace, and generate a step-by-step implementation guide grounded in
actual files from your codebase.

The extension can also ask the selected model to draft file edits for the guide,
show those edits in a review screen, let you skip files or reject individual
hunks, apply the accepted changes, and undo the last apply.

## Features

- **Assigned Jira ticket list** - Loads up to 50 issues assigned to the current
  Jira user with status, priority, issue type, key, and summary.
- **Ticket detail fetch** - Retrieves summary, description, labels, status,
  priority, issue type, and common acceptance-criteria custom fields.
- **Semantic code search** - Indexes supported repository files, chunks source
  code, embeds chunks with `openai/text-embedding-3-large`, and ranks snippets
  with cosine similarity.
- **OpenRouter model settings** - Stores an OpenRouter API key and lets you pick
  a chat model from pinned defaults or the OpenRouter model list.
- **Structured implementation guides** - Produces JSON-backed guide steps with
  file references, line ranges, and implementation rationale.
- **Editor navigation** - Opens retrieved snippets and guide file references
  directly in the VS Code editor.
- **Reviewable AI edits** - Generates proposed file changes, shows a per-file
  diff, supports skipping files and rejecting hunks, then applies only the
  accepted result.
- **Undo last apply** - Keeps a pre-apply snapshot so the most recent apply can
  be restored from the sidebar.
- **Secure credential storage** - Stores Jira credentials, OpenRouter API key,
  and model preference with VS Code `SecretStorage`.
- **Incremental cache** - Persists the embedding index as JSON in VS Code global
  storage and reuses unchanged file chunks based on modification time.

## Demo Video

[Watch the Ticket to Code Orchestrator demo](media/Ticket_to_Code_Orchestrator.mp4)

## Screenshots

### Jira Ticket And Repository Analysis

![Jira ticket analysis](media/Jira%20ticket%20Analysis.png)

![Repository analysis](media/Repo%20Analysis.png)

### Implementation Guide And Apply Flow

![Generated implementation guide](media/Implementation%20Guide.png)

![Diff review](media/Diff%20View.png)

![Applied changes](media/Applied%20Changes.png)

## Current AI Defaults

| Setting | Current value |
| --- | --- |
| Provider | OpenRouter |
| Default chat model | `~anthropic/claude-haiku-latest` |
| Pinned alternate chat model | `~google/gemini-flash-latest` |
| Embedding model | `openai/text-embedding-3-large` |
| Embedding provider path | OpenRouter-compatible `/v1/embeddings` endpoint |

The chat model is configurable from the sidebar settings panel. The embedding
model is fixed in code so cached vectors stay compatible; if the embedding
model changes, the extension clears and rebuilds the embedding index.

## Prerequisites

- VS Code `1.85+`
- Node.js and npm for local development
- A Jira API token from your Atlassian account
- An OpenRouter API key from `https://openrouter.ai/keys`

## Install

Install from the VS Code Marketplace:

https://marketplace.visualstudio.com/items?itemName=yugm-patel-1312.ticket-to-code-ai-companion

## Configuration

On first use, the extension prompts for Jira credentials when it tries to load
assigned tickets:

| Setting | Description |
| --- | --- |
| Jira Base URL | Your Jira instance, for example `https://yourorg.atlassian.net` |
| Jira Email | The email address tied to your Jira account |
| Jira API Token | A Jira API token from Atlassian account settings |

Open the gear button in the sidebar to configure AI settings:

| Setting | Description |
| --- | --- |
| Model | OpenRouter chat model slug, defaulting to `~anthropic/claude-haiku-latest` |
| API key | OpenRouter API key, stored securely in VS Code `SecretStorage` |

## How It Works

```text
1. LOAD TICKETS
   Jira REST API returns issues assigned to the current user.

2. FETCH TICKET
   The selected issue is normalized into summary, description, acceptance
   criteria, labels, priority, status, and issue type.

3. ANALYZE REPO
   The extension walks the active workspace, skips generated and dependency
   folders, chunks supported files, embeds uncached chunks, and retrieves the
   most relevant snippets.

4. GENERATE GUIDE
   Ticket context and selected snippets are sent to the configured OpenRouter
   chat model. The response is validated into structured guide steps.

5. IMPLEMENT AND REVIEW
   The model proposes edits for referenced files. The webview shows a diff where
   files can be skipped and hunks can be rejected before applying changes.
```

## Architecture

![Ticket to Code architecture diagram](media/Architecture%20Ticket%20to%20code%20orchestrator.jpeg)

```text
VS Code Activity Bar
        |
        v
React Webview UI
TicketPanel | AnalysisPanel | GuidePanel | DiffViewer | ModelPickerDialog
        |
        | postMessage
        v
Extension Host
SidebarProvider
        |
        +-- Security        -> VS Code SecretStorage
        +-- TicketManager   -> JiraClient -> Jira REST API
        +-- CodeAnalyzer    -> file walking, chunking, embeddings, similarity
        +-- AIEngine        -> guide generation and edit generation
        +-- CacheManager    -> ticket cache and embedding-index JSON
        |
        v
Workspace files and VS Code global storage
```

The React webview is sandboxed and communicates with the extension host only
through VS Code `postMessage`. The extension host owns file access, credential
storage, Jira calls, OpenRouter calls, cache persistence, and editor navigation.

## Repository Indexing Details

- Supported files include TypeScript, JavaScript, Python, Java, C#, Go, Ruby,
  PHP, Swift, Kotlin, Rust, C/C++, Markdown, JSON, YAML, HTML, CSS, SCSS, and
  shell scripts.
- The walker skips dependency, build, cache, and hidden folders such as
  `node_modules`, `dist`, `build`, `.git`, `.vscode`, `.next`, `coverage`, and
  `.cache`.
- Files larger than 500 KB are skipped.
- Files are chunked into 80-line windows with a 15-line overlap.
- Search starts with the top 20 semantically similar chunks, deduplicates them,
  applies a small file-type relevance boost, and keeps up to 10 snippets within
  a 12,000-character context budget.

## Commands

The extension contributes these VS Code commands:

| Command | Description |
| --- | --- |
| `Ticket to Code: Reset Credentials` | Clears Jira credentials, OpenRouter API key, and saved chat model |
| `Ticket to Code: Clear Embedding Index` | Deletes the cached embedding index so the repository can be re-indexed |

## Tech Stack

| Layer | Technology |
| --- | --- |
| Extension host | TypeScript, VS Code Extension API, esbuild |
| Webview UI | React 18, TypeScript, Vite |
| Chat models | OpenRouter chat-completions API, default `~anthropic/claude-haiku-latest` |
| Embeddings | `openai/text-embedding-3-large` |
| Retrieval | JSON vector cache, cosine similarity, file-type boosting |
| Jira integration | Jira Cloud REST API |
| Auth storage | VS Code `SecretStorage` |
| Testing | Jest and ts-jest |

## Project Structure

```text
src/
  extension/
    clients/       JiraClient and OpenAI-compatible API client
    engine/        Security, TicketManager, CodeAnalyzer, AIEngine, CacheManager
    sidebar/       VS Code WebviewViewProvider and host message handlers
    utils/         ADF parsing, file walking, chunking, retrieval, navigation
    __tests__/     unit tests, e2e suites, and VS Code mocks
  webview/
    components/    TicketPanel, AnalysisPanel, GuidePanel, DiffViewer, model picker
    styles.css     VS Code theme-aware webview styling
    App.tsx        webview state machine and message handling
docs/
  architecture.md  architecture decision records
media/
  icon.svg         activity bar icon
```

## Local Development

Install dependencies:

```bash
npm install
```

Run extension and webview watch builds:

```bash
npm run dev
```

Build everything:

```bash
npm run build
```

Run unit tests:

```bash
npm test
```

Run coverage:

```bash
npm run test:coverage
```

Prepare a production extension bundle:

```bash
npm run vscode:prepublish
```

To launch the extension in development, press `F5` in VS Code and use the
`Run Extension` launch configuration. The pre-launch task builds both the
extension host bundle and the webview bundle.

## Current Limitations

- The sidebar currently focuses on the current user's assigned Jira tickets.
- The embedding model is fixed to `openai/text-embedding-3-large`.
- The vector store is a local JSON file, which keeps setup simple but is not a
  dedicated vector database.
- If files change between diff generation and apply, the extension warns about
  conflicts and still applies the accepted diff, so review the result carefully.

## Roadmap

- Manual ticket-key entry in addition to assigned-ticket browsing
- GitHub Issues and Linear support
- Local embedding model option
- More scalable vector storage for very large repositories
- Richer apply safeguards and merge-aware conflict handling
