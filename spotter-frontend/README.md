# spotter-frontend

This project was created with [Better Fullstack](https://github.com/Marve10s/Better-Fullstack), a modern TypeScript stack that combines React, Vite SPA, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **React + Vite** - Client-routed React SPA powered by Vite
- **TailwindCSS** - CSS framework
- **shadcn/ui** - UI components
- **Biome** - Linting and formatting
- **TanStack Query** - Async state management & data fetching
- **TanStack Table** - Headless table with sorting, filtering & pagination

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

Then, run the development server:

```bash
pnpm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to see the web application.

## Git Hooks and Formatting

- Format and lint fix: `pnpm run check`

## Project Structure

```
spotter-frontend/
├── apps/
│   ├── web/         # Frontend application (React + Vite SPA)
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run dev:web`: Start only the web application
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run check`: Run Biome formatting and linting
