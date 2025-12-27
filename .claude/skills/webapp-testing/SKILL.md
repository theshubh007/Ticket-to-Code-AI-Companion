---
name: webapp-testing
description: Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, and viewing browser logs. Use when testing VS Code webview panels, React UIs built with Vite, or any local web application. Triggers on requests to test the UI, verify frontend behavior, take screenshots, or automate browser interactions.
license: Source — Anthropic Skills (https://github.com/anthropics/skills). Used under their published terms.
---

# Web Application Testing

Test local web applications using native Python Playwright scripts.

## Decision Tree: Choosing Your Approach

```
User task → Is it static HTML?
    ├─ Yes → Read HTML file directly to identify selectors
    │         ├─ Success → Write Playwright script using selectors
    │         └─ Fails/Incomplete → Treat as dynamic (below)
    │
    └─ No (dynamic webapp) → Is the server already running?
        ├─ No → Start the dev server first (npm run dev / vite)
        │        Then write Playwright script against localhost
        │
        └─ Yes → Reconnaissance-then-action:
            1. Navigate and wait for networkidle
            2. Take screenshot or inspect DOM
            3. Identify selectors from rendered state
            4. Execute actions with discovered selectors
```

## Starting the Dev Server

For this project (Vite webview):

```bash
# Build webview first
npm run build:webview

# Or run in watch mode
npm run watch:webview
```

## Basic Playwright Script

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')  # CRITICAL: wait for JS to execute
    
    # Take a screenshot
    page.screenshot(path='/tmp/webview.png', full_page=True)
    
    # Inspect the DOM
    content = page.content()
    buttons = page.locator('button').all()
    
    browser.close()
```

## Reconnaissance-Then-Action Pattern

**Step 1** — Inspect the rendered state:
```python
page.screenshot(path='/tmp/inspect.png', full_page=True)
# Then view the screenshot to understand the layout

# Or inspect DOM
elements = page.locator('[data-testid]').all()
for el in elements:
    print(el.get_attribute('data-testid'), el.inner_text())
```

**Step 2** — Identify selectors from inspection results

**Step 3** — Execute actions using discovered selectors:
```python
# Click a button
page.locator('text=Load Ticket').click()

# Fill an input
page.locator('#ticket-id-input').fill('PROJ-123')

# Wait for response
page.wait_for_selector('.ticket-panel', state='visible')
```

## Common Playwright Patterns

```python
# Wait for a specific element
page.wait_for_selector('.result-panel', state='visible', timeout=10000)

# Get text content
text = page.locator('.ticket-title').inner_text()

# Check if element exists
is_visible = page.locator('.error-banner').is_visible()

# Capture console logs
logs = []
page.on('console', lambda msg: logs.append(msg.text))

# Capture network requests
requests = []
page.on('request', lambda req: requests.append(req.url))
```

## Testing React Components (Vite Dev Server)

```python
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)  # headless=False to debug visually
    page = browser.new_page()
    
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')
    
    # Test ticket input flow
    page.locator('[placeholder="Enter Jira ticket ID"]').fill('PROJ-456')
    page.locator('button:has-text("Load")').click()
    
    # Wait for async result
    page.wait_for_selector('.guide-panel', state='visible', timeout=15000)
    
    # Assert content
    expect(page.locator('.ticket-title')).to_be_visible()
    expect(page.locator('.error-banner')).not_to_be_visible()
    
    page.screenshot(path='/tmp/result.png')
    browser.close()
```

## Best Practices

- **Always wait for `networkidle`** before inspecting on dynamic apps — React hasn't rendered until JS runs
- Use **descriptive selectors**: `text=`, `role=`, `data-testid=`, or IDs
- **Always close the browser** when done
- Add appropriate waits: `wait_for_selector()` rather than `sleep()`
- Set `headless=False` when debugging to see the browser visually
- Use `page.screenshot()` liberally — it's the fastest way to understand the current state

## Common Pitfall

❌ **Don't** inspect the DOM before waiting for `networkidle` on dynamic apps  
✅ **Do** wait for `page.wait_for_load_state('networkidle')` before any inspection

## Installing Playwright

```bash
pip install playwright
playwright install chromium
```
