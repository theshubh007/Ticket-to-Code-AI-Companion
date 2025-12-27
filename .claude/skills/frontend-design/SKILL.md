---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, or applications — including VS Code webview panels, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI. Generates creative, polished code that avoids generic AI aesthetics. Triggers on requests to "design", "style", "beautify", "make it look better", or build any UI component.
license: Source — Anthropic Skills (https://github.com/anthropics/skills). Used under their published terms.
---

# Frontend Design

Create distinctive, production-grade interfaces that avoid generic "AI slop" aesthetics.

## Design Thinking Framework

Before writing code, commit to a **BOLD aesthetic direction** by considering:

- **Purpose**: What problem does this solve? Who are the users?
- **Tone**: Pick an extreme — brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, or industrial/utilitarian
- **Constraints**: Framework, performance, accessibility requirements
- **Differentiation**: What makes this memorable and context-appropriate?

## Frontend Aesthetics Guidelines

### Typography
- Use **distinctive fonts that elevate the design** — unexpected, characterful choices
- Pair a display/headline font with a refined body font
- **Avoid**: Arial, Inter, Roboto, Space Grotesk — these are overused defaults

### Color & Theme
- Build a cohesive palette with CSS custom properties
- Use dominant colors with sharp accent colors rather than timid, evenly-distributed palettes
- Implement dark/light themes using CSS variables

### Motion & Interaction
- CSS-only animations preferred for performance
- Prioritize **high-impact moments**: staggered page-load reveals, scroll-triggered entrances
- Avoid scattered micro-interactions that don't serve the experience

### Spatial Composition
- Embrace asymmetry, overlap, diagonal flow, grid-breaking elements
- Use generous negative space OR controlled density — not muddled middle ground
- Break out of predictable card/grid layouts when context supports it

### Backgrounds & Atmosphere
- Gradient meshes, noise textures, geometric patterns, layered transparencies
- Dramatic shadows, grain overlays, blurred shapes for depth
- Go beyond solid background colors

## Critical Guidelines

**No design should look the same** — vary between light/dark, different typefaces, different spatial approaches.

**Avoid generic AI-generated aesthetics**:
- Purple gradients on white/dark backgrounds
- Excessive rounded corners on everything
- Centered layouts with no visual interest
- Inter font + slate color palette
- Cookie-cutter card grids

## Implementation Patterns

```css
/* Example: CSS custom property theming */
:root {
  --color-bg: #0a0a0f;
  --color-surface: #12121a;
  --color-accent: #7c3aed;
  --color-accent-glow: rgba(124, 58, 237, 0.3);
  --color-text: #e8e8f0;
  --color-muted: #6b7280;
  --font-display: 'Clash Display', system-ui;
  --font-body: 'DM Sans', system-ui;
  --radius: 4px;
  --transition: 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Page-load stagger animation */
@keyframes fade-up {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

.stagger-1 { animation: fade-up 0.4s var(--transition) 0.1s both; }
.stagger-2 { animation: fade-up 0.4s var(--transition) 0.2s both; }
.stagger-3 { animation: fade-up 0.4s var(--transition) 0.3s both; }
```

```tsx
// React component with intentional design
function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <article className="ticket-card">
      <span className="ticket-id">{ticket.id}</span>
      <h2 className="ticket-title">{ticket.summary}</h2>
      <div className="ticket-meta">
        <span className="priority" data-level={ticket.priority}>{ticket.priority}</span>
        <span className="assignee">{ticket.assignee}</span>
      </div>
    </article>
  );
}
```

## VS Code Webview Design

When designing for VS Code webviews, **always use VS Code theme tokens** as the base, then layer your aesthetic on top:

```css
.panel {
  /* Base: VS Code tokens */
  background: var(--vscode-sideBar-background);
  color: var(--vscode-editor-foreground);
  font-family: var(--vscode-font-family);
  
  /* Layer: your aesthetic additions */
  border-left: 2px solid var(--vscode-focusBorder);
}
```

This ensures the UI looks native in all VS Code themes while still having character.
