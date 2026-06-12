# spotter

This file provides context about the monorepo for AI assistants.

## Project Overview

**Spotter** is a full-stack ELD Trip Planner: a web app that helps truck drivers plan trips while staying compliant with US Hours of Service (HOS) rules. Drivers pick locations on a map; the app calculates drive/rest schedules and generates daily ELD log sheets.

See `ELD-Trip-Planner-PRD.md` for product requirements, HOS rules, and API contracts.

## Repository Layout

```
spotter/
├── .agents/skills/          # Shared agent skills (design-engineer, React patterns, etc.)
├── .codex/                  # Codex MCP config
├── .vscode/                 # VS Code MCP config
├── skills-lock.json         # Installed skill registry
├── spotter-frontend/        # React/Vite web application
└── spotter-backend/         # Django REST API
    ├── src/app/             # Application code
    └── tests/               # Test suite
```

Subprojects also have their own `Agents.md` / `CLAUDE.md` with package-specific details.

## Tech Stack

### Frontend (`spotter-frontend/`)

- **Runtime**: Node.js
- **Package manager**: pnpm
- **Framework**: React 19 + Vite
- **Routing**: React Router
- **CSS**: Tailwind CSS v4
- **UI**: shadcn/ui, Radix, Base UI
- **State**: Zustand, TanStack Query
- **Testing**: Vitest, Testing Library
- **Lint/format**: Biome

### Backend (`spotter-backend/`)

- **Runtime**: Python 3.11+
- **Package manager**: uv
- **Framework**: Django 5
- **API**: Django REST Framework
- **Testing**: pytest

## Common Commands

Run these from the relevant subproject directory.

### Frontend

```bash
cd spotter-frontend
pnpm install
pnpm dev              # Start development server
pnpm build
pnpm check-types
pnpm check            # Biome lint/format
```

### Backend

```bash
cd spotter-backend
cp .env.example .env
uv sync --extra dev
uv run python -m app.main
uv run --extra dev pytest
```

## Agent Skills

Shared skills live in `.agents/skills/`:

- `design-engineer` — UI/UX polish, design audits, motion, interaction patterns
- `vercel-composition-patterns` — React compound components, avoid boolean prop sprawl
- `vercel-react-best-practices` — React/Next performance and data-fetching patterns
- `web-design-guidelines` — Web design review checklist

Invoke with `$design-engineer`, etc. Read the skill's `SKILL.md` before using it.

## Maintenance

Keep CLAUDE.md updated when:

- Adding/removing dependencies or subprojects
- Changing repo structure or agent tooling
- Adding new features or services
- Modifying build/dev workflows

AI assistants should suggest updates to this file when they notice relevant changes.
