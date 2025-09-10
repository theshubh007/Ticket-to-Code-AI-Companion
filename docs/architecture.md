# Architecture Decision Records

## ADR-001: esbuild for extension host bundling
**Decision**: Use esbuild instead of Webpack for bundling the extension host.  
**Reason**: esbuild is the current VS Code team recommendation, 10-100x faster builds, minimal config.

## ADR-002: Vite for WebView bundling
**Decision**: Use Vite for the React WebView bundle.  
**Reason**: First-class React support, HMR during development, esbuild-powered transforms.

## ADR-003: JSON flat file as vector store (MVP)
**Decision**: Store embeddings as a JSON file on disk, load into memory for cosine similarity search.  
**Reason**: No native dependencies, no setup friction. Upgrade path to LanceDB or SQLite-vec is isolated to CodeAnalyzer.

## ADR-004: postMessage as the only UI↔Host bridge
**Decision**: All communication between React WebView and extension host goes through postMessage.  
**Reason**: VS Code sandboxes the WebView — it has no access to Node.js, file system, or VS Code APIs. This is enforced by the platform, not a design choice.

## ADR-005: VS Code SecretStorage for credentials
**Decision**: API keys (Jira token, OpenAI key) stored exclusively in context.secrets.  
**Reason**: SecretStorage encrypts at rest using the OS keychain. Never written to disk in plaintext.