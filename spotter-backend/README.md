# spotter-backend

This project was created with [Better Fullstack](https://github.com/Marve10s/Better-Fullstack), a high-performance Python stack.

## Features

- **Python** - Modern, readable programming language
- **Django** - High-level Python web framework with batteries included
- **Django REST Framework** - Mature toolkit for building Django REST APIs

## Prerequisites

- [Python](https://www.python.org/) 3.11 or higher
- [uv](https://docs.astral.sh/uv/) (Recommended package manager)

## Getting Started

First, copy the environment file:

```bash
cp .env.example .env
```

Then, install dependencies using uv:

```bash
uv sync --extra dev
```

Start the Django development server:

```bash
uv run python -m app.main
```

The application will be running at [http://localhost:8000](http://localhost:8000).

## Project Structure

```
spotter-backend/
├── pyproject.toml        # Project configuration and dependencies
├── src/
│   └── app/
│       ├── __init__.py
│       └── main.py       # Application entry point
├── tests/
│   ├── __init__.py
│   └── test_main.py      # Test suite
├── .env.example          # Environment variables template
└── .gitignore
```

## Available Commands

- `uv run python -m app.main`: Start Django dev server
- `uv run --extra dev pytest`: Run tests
