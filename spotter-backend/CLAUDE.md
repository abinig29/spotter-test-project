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

## Maintenance

Keep CLAUDE.md updated when:

- Adding/removing dependencies
- Changing project structure
- Adding new features or services
- Modifying build/dev workflows

AI assistants should suggest updates to this file when they notice relevant changes.
