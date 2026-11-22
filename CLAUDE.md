# AGENTS.md

Context for AI coding agents working in this repository.

## What this is

A small hotel recommendation demo for the company assessment. A traveller enters a hotel request, reviews the assistant's recommendations, and selects one hotel. Time-boxed to four hours.

**In scope:** one page (request form, demo scenario control, loading, empty and error states, hotel cards,
single selection with a summary) and `POST /recommendations` with validation and three scenarios.
**Out of scope:** natural-language interpretation, filtering or totals, live models, streaming, scraping,
booking, persistence of the selection, authentication, database, deployment, access to any Serko system.

## Architecture

Two independently runnable processes. The only coupling is the HTTP contract.

- `web/`: Next.js App Router, React, TypeScript, Tailwind CSS. One client component (`Journey`) owns the journey
  state with `useReducer`. No state library and no data-fetching library. API calls live in `api.ts`, not in components.
- `api/`: Python FastAPI with Pydantic. `main.py` (route, CORS, scenario switch), `models.py`, `fixtures.py`.
- The browser calls the API directly (CORS), with no proxy.

## API contract

`openapi.yaml` at the repo root is the source of truth. Read it before changing either side.

- `POST /recommendations`, body `{message, scenario}`.
- `message`: required, at least one non-whitespace character. `scenario`: optional, `success | empty | error`, default `success`.
- `success` returns 200 `{message, hotels}` with the three fixtures. `empty` returns 200 with `hotels: []`.
  `error` returns 503 `{code: "service_unavailable", message}`.
- Invalid input returns 422 `{code: "validation_error", message}`. Validation runs **before** the scenario,
  so a blank message with `scenario=error` is 422, not 503.
- Every error body has the same `{code, message}` shape.
- Hotel fields: `id, name, nightlyPrice (number), currency, breakfastIncluded (boolean), explanation`.
- Fixtures are exactly the three hotels in the assessment brief. Do not change their values.

## Structure

Run `git ls-files` for the current layout. Key files: `openapi.yaml`, `api/main.py`, `api/models.py`, `api/fixtures.py`,
`api/test_api.py`, `web/app/components/Journey.tsx`, `web/app/components/HotelCard.tsx`, `api.ts`, the Vitest test file, `README.md`, `APPROACH.md`.

## Commands (Windows PowerShell)

```powershell
# API  (from api/, venv active)
uvicorn main:app --reload --port 8000
python -m pytest -v

# Web  (from web/)
npm run dev
npm test
npm run build
```

Environment variables (defaults in `.env.example`): `FIXTURE_DELAY_MS`, `CORS_ORIGINS` (API), `NEXT_PUBLIC_API_BASE_URL` (web).
The API reads real environment variables only. Tests set `FIXTURE_DELAY_MS=0`.

## Constraints

- Local fixture data only. No real booking, no external hotel API, no AI model.
- Keep it small: no new dependencies, services, or abstractions without being asked. No Redux, Zustand, or similar.
- No secrets, personal information, or machine-specific paths in any committed file. Never commit `.env`, `.venv`, `node_modules`, or `.next`.
- The UI must work on small screens, with keyboard access, accessible labels, and visible focus.

## Instructions for AI agents

1. **Contract first.** Change `openapi.yaml` before the code that depends on it. Make a contract change its own commit
   and add a row to the contract revisions table in `APPROACH.md`.
2. **Never claim a test or build passed unless you ran it and saw it pass.** If you cannot run something, say so.
   Never invent screenshots, results, timings, or agent interactions.
3. Keep the `{code, message}` error shape and the validation-before-scenario order.
4. Do not interpret the user's message. `scenario` is a demo control, not product logic.
5. Match existing style. Prefer editing a file over adding one. Do not add features.
6. Work on `main` with small commits and clear messages. Do not rewrite history.
7. Before finishing a change, run the relevant test command above and report the real output.
