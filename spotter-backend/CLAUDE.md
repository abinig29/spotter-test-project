# spotter-backend

This file provides context about the project for AI assistants.

## Project Overview

- **Ecosystem**: Python

## Tech Stack

- Web Framework: django
- API Framework: django-rest-framework

## Project Structure

```
spotter-backend/
├── pyproject.toml   # Project config
├── src/
│   └── app/         # Application code
├── tests/           # Test suite
```

## Common Commands

- `uv sync --extra dev` - Install dependencies
- `uv run python -m app.main` - Run application
- `uv run --extra dev pytest` - Run tests

`ORS_API_KEY` (OpenRouteService) is required for `POST /api/trip/plan`; without it the
endpoint returns 503. Copy `.env.example` to `.env` and set it.

## Maintenance

Keep CLAUDE.md updated when:

- Adding/removing dependencies
- Changing project structure
- Adding new features or services
- Modifying build/dev workflows

AI assistants should suggest updates to this file when they notice relevant changes.
