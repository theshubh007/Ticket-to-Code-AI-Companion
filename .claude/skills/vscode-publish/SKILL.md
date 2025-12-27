---
name: vscode-publish
description: Complete guide for packaging, testing, and publishing VS Code extensions to the Marketplace. Covers vsce commands, publisher setup, .vscodeignore, versioning strategy, pre-publish validation, CHANGELOG.md, icon requirements, and CI/CD with GitHub Actions. Use when preparing a VS Code extension for release, bumping versions, setting up automated publishing, or troubleshooting vsce errors. Triggers on mentions of vsce, Marketplace, publisher, VSIX, publishing, or version bump.
---

# VS Code Extension Publishing Guide

## One-Time Publisher Setup

1. Create a [Visual Studio Marketplace publisher](https://marketplace.visualstudio.com/manage)
2. Generate a Personal Access Token (PAT) in Azure DevOps with **Marketplace (publish)** scope
3. Login via vsce:

```bash
npm install -g @vscode/vsce
vsce login <publisher-id>
# Paste your PAT when prompted
```

## package.json Publishing Fields

```json
{
  "publisher": "your-publisher-id",
  "name": "my-extension",
  "displayName": "My Extension",
  "description": "Clear one-sentence description of what it does",
  "version": "1.0.0",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "keywords": ["jira", "ai", "productivity"],
  "icon": "media/icon.png",
  "galleryBanner": {
    "color": "#1a1a2e",
    "theme": "dark"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/your-repo"
  },
  "bugs": { "url": "https://github.com/your-org/your-repo/issues" },
  "homepage": "https://github.com/your-org/your-repo#readme",
  "license": "MIT",
  "scripts": {
    "vscode:prepublish": "npm run build"
  }
}
```

## Icon Requirements

- **Format**: PNG only
- **Size**: 128×128 pixels minimum (256×256 recommended)
- **Location**: `media/icon.png` (referenced in `package.json`)
- **Background**: Should look good on both light and dark Marketplace backgrounds

## .vscodeignore

Exclude everything that shouldn't ship:

```
# Source files (already compiled)
src/
**/*.ts
!dist/**

# Dev dependencies
node_modules/
.vscode-test/

# Config files
.eslintrc*
.prettierrc*
jest.config.*
tsconfig*.json
vite.config.*
esbuild.config.*

# Dev artifacts
**/*.map
coverage/
graphify-out/

# Docs and tests (keep README.md — it's the Marketplace page)
docs/
**/__tests__/
**/*.test.*
**/*.spec.*
```

## CHANGELOG.md Format

```markdown
# Change Log

## [Unreleased]

## [1.1.0] - 2026-05-04
### Added
- Live model picker with OpenRouter model list

### Fixed
- Model combobox now shows full list instead of two options

## [1.0.0] - 2026-04-01
### Added
- Initial release
```

## Versioning Commands

```bash
# Patch bump (1.0.0 → 1.0.1) — bug fixes
vsce publish patch

# Minor bump (1.0.0 → 1.1.0) — new features, backward compatible
vsce publish minor

# Major bump (1.0.0 → 2.0.0) — breaking changes
vsce publish major

# Specific version
vsce publish 1.2.3

# Package without publishing (creates .vsix)
vsce package

# Install locally for testing
code --install-extension my-extension-1.0.0.vsix

# List what will be included
vsce ls
```

## Pre-Publish Checklist

```bash
# 1. Run all tests
npm test

# 2. Build production bundle
npm run build

# 3. Check included files
vsce ls

# 4. Test locally
vsce package
code --install-extension *.vsix
# Manually test all core flows

# 5. Bump version in package.json and CHANGELOG.md

# 6. Publish
vsce publish
```

## GitHub Actions CI/CD

```yaml
# .github/workflows/publish.yml
name: Publish Extension

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - run: npm ci
      
      - run: npm test
      
      - run: npm run build
      
      - name: Publish to Marketplace
        run: npx @vscode/vsce publish
        env:
          VSCE_PAT: ${{ secrets.VSCE_PAT }}
```

Add `VSCE_PAT` as a GitHub repository secret.

## Common vsce Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Missing publisher` | No `publisher` in package.json | Add `"publisher": "your-id"` |
| `Missing icon` | Icon path wrong or file missing | Check `media/icon.png` exists |
| `Error 401` | PAT expired or wrong scope | Regenerate PAT with Marketplace (publish) scope |
| `Files too large` | node_modules included | Add `node_modules/` to `.vscodeignore` |
| `dist/ missing` | Build not run first | Run `npm run build` before `vsce package` |
| `description too long` | Description > 100 chars | Shorten the `description` field |

## Marketplace README Tips

Your `README.md` becomes the Marketplace page. Include:
- **Screenshot or GIF** showing the extension in action (first 5 lines are the preview)
- **Requirements** (API keys needed, VS Code version)
- **Quick Start** steps
- **Features list**
- **Configuration** options table
- **Known limitations**
