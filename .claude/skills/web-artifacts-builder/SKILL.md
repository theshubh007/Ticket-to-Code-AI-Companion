---
name: web-artifacts-builder
description: Build sophisticated multi-component React UIs using React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui components. Use when creating complex webview panels, dashboards, data visualization UIs, or self-contained HTML artifacts. Covers the full workflow from scaffolding to bundling. Triggers on requests to build a React component with Tailwind, use shadcn/ui, create a dashboard, or produce a polished multi-component UI.
license: Source — Anthropic Skills (https://github.com/anthropics/skills). Used under their published terms.
---

# Web Artifacts Builder

Build sophisticated multi-component React UIs using the React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui stack.

## Technology Stack

- **React 18** — component model
- **TypeScript** — type safety
- **Vite** — fast dev server and bundler
- **Tailwind CSS 3.4** — utility-first styling
- **shadcn/ui** — accessible, unstyled components built on Radix UI
- **Parcel** — for single-file artifact bundling (optional)

## Project Setup

```bash
# Scaffold a new Vite + React + TS project
npm create vite@latest my-ui -- --template react-ts
cd my-ui
npm install

# Add Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Add shadcn/ui
npx shadcn-ui@latest init
```

### tailwind.config.js

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
```

## Installing shadcn/ui Components

```bash
# Install individual components as needed
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add card
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add scroll-area
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add skeleton
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add command    # for comboboxes / search
npx shadcn-ui@latest add popover
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add progress
```

## Component Patterns

### Data Display Card

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TicketCardProps {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  status: string;
}

export function TicketCard({ id, title, priority, status }: TicketCardProps) {
  const priorityColors = { high: 'destructive', medium: 'default', low: 'secondary' } as const;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-mono">{id}</span>
          <Badge variant={priorityColors[priority]}>{priority}</Badge>
        </div>
        <CardTitle className="text-sm leading-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <span className="text-xs text-muted-foreground">{status}</span>
      </CardContent>
    </Card>
  );
}
```

### Searchable Combobox

```tsx
import { useState } from 'react';
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface Option { value: string; label: string; }

export function SearchableSelect({ options, onSelect }: { options: Option[]; onSelect: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>('');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          {selected || 'Select model...'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {options.map(opt => (
              <CommandItem key={opt.value} value={opt.value} onSelect={(v) => {
                setSelected(v);
                onSelect(v);
                setOpen(false);
              }}>
                {opt.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

### Loading Skeleton

```tsx
import { Skeleton } from '@/components/ui/skeleton';

export function TicketSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="space-y-2 mt-4">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );
}
```

## Design Principles

Avoid common "AI slop" aesthetics:
- **No** excessive centered layouts
- **No** purple gradients on white backgrounds
- **No** uniform rounded corners on every element
- **No** Inter font for everything — vary your type choices
- **Do** use intentional hierarchy, spacing, and color contrast

## VS Code Webview Integration

When using this stack inside a VS Code webview, override Tailwind's base styles with VS Code tokens:

```css
/* In your global CSS */
:root {
  --background: var(--vscode-editor-background);
  --foreground: var(--vscode-editor-foreground);
  --muted: var(--vscode-sideBar-background);
  --muted-foreground: var(--vscode-descriptionForeground);
  --border: var(--vscode-panel-border);
  --input: var(--vscode-input-background);
  --primary: var(--vscode-button-background);
  --primary-foreground: var(--vscode-button-foreground);
}
```

This bridges the Tailwind/shadcn token system with VS Code's native theming.
