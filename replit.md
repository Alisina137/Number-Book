# Number Book Studio

An AI-powered studio for creating KDP-ready numbered-entry books (Fun Facts, Trivia, Jokes, Riddles, etc.) in 4 guided steps: Research → Blueprint → Write → Quality → Export.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `OPENAI_API_KEY` — for blueprint + content generation

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 at `/api`
- DB: PostgreSQL + Drizzle ORM
- Frontend: React + Vite + Tailwind + shadcn/ui + wouter + framer-motion
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- AI: OpenAI via `OPENAI_API_KEY` env secret, model `gpt-5-mini`

## Where things live

- DB schema: `lib/db/src/schema/` — `books.ts` and `entries.ts`
- OpenAPI spec: `lib/api-spec/openapi.yaml` — source of truth for API contract
- API Zod schemas: `lib/api-zod/src/generated/api.ts`
- React hooks: `lib/api-client-react/src/generated/api.ts`
- API routes: `artifacts/api-server/src/routes/` — `books.ts`, `entries.ts`, `quality.ts`
- AI logic: `artifacts/api-server/src/lib/bookAI.ts` — blueprint gen, content prompts, word count
- Frontend pages: `artifacts/number-book-studio/src/pages/`
- Theme: `artifacts/number-book-studio/src/index.css` — warm off-white + terracotta + dark sidebar

## Architecture decisions

- Contract-first: OpenAPI spec → codegen → Zod schemas + React Query hooks. Never write these by hand.
- AI uses user's own `OPENAI_API_KEY` directly (not Replit AI integration), so the api-server imports from `src/lib/openai.ts`.
- Blueprint generation deletes all existing entries before re-generating, so regenerating is always safe.
- Word count validation retries content generation up to 3x to hit the min/max target range.
- Quality report uses Jaccard similarity (>85%) to detect duplicate content between entries.

## Product

- **Dashboard**: List all books, see status, open or delete
- **New Book**: Configure niche hierarchy, audience, tone, entry count, word range
- **Blueprint**: AI generates all entry titles in one shot; can regenerate
- **Write**: Generate content per entry with word-count-aware AI prompts; lock entries
- **Quality**: Automated quality report — duplicates, word count issues, audience flags
- **Export**: Download assembled book as TXT or Markdown

## Gotchas

- The `@workspace/integrations-openai-ai-server` lib throws at import if `AI_INTEGRATIONS_OPENAI_BASE_URL` is missing — do NOT import it in api-server. Use `src/lib/openai.ts` instead.
- After editing any route, always rebuild the api-server before restarting the workflow.
- `pnpm --filter @workspace/api-spec run codegen` must be re-run after any OpenAPI spec change before touching routes or hooks.
