# Hotel Recommendation Assistant

A small demo for the assessment. A traveller types a hotel request, reviews the
assistant's recommendations, and selects one hotel.

- All data is **local fixture data**. There is no AI model, no natural-language interpretation, no database, no authentication, and **no real booking**.
- The `scenario` field is a **demo control** that makes the API return a success, an empty result, or an error.

## Architecture

Two independent processes that share no code. The only coupling is the HTTP contract in [`openapi.yaml`](openapi.yaml).

```
Browser: Next.js (App Router, port 3000)
  one client component holds the journey state (useReducer)
        |  POST {NEXT_PUBLIC_API_BASE_URL}/recommendations   (JSON, CORS)
        v
FastAPI (port 8000)
  Pydantic validation -> scenario switch -> in-memory fixtures
```

```
.
├─ AGENTS.md  CLAUDE.md  README.md  APPROACH.md  openapi.yaml  .env.example  .gitignore
├─ api/    main.py  models.py  fixtures.py  test_api.py  requirements.txt
└─ web/    app/ (layout, page, globals.css, components/Journey, HotelCard, Journey.test)
           api.ts (client and types)  vitest.config.ts  vitest.setup.ts  package.json  package-lock.json
```

## Runtime versions

Node.js v26.13.1
npm 11.20.0
Python 3.15.2
Next.js next@16.4.6

Exact pinned lists: `web/package-lock.json` and `api/requirements.txt`.

## Prerequisites

- Git
- A Node.js version supported by the installed Next.js (see the Next.js documentation for the minimum)
- Python 3 with `venv`
- Two terminals (one per process)

Commands below are for **Windows PowerShell**. On macOS or Linux, activate the venv with `source .venv/bin/activate`.

## Install

```powershell
# API
cd api
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Web (new terminal, from the repo root)
cd web
npm install
```

If PowerShell blocks the activate script: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` (this session only).

## Environment variables

No secrets are needed. [`.env.example`](.env.example) lists every variable with its default.

- The **API reads real environment variables only** (it does not load `.env` files). Set them in the shell before starting it, for example `$env:FIXTURE_DELAY_MS = "2500"`.
- The **web app** reads `web/.env.local`. Copy the `NEXT_PUBLIC_` line there only if you change the default.
- Never commit `.env` or `.env.local`.

## Run

```powershell
# Terminal 1: API  (from api/, venv active)
uvicorn main:app --reload --port 8000

# Terminal 2: Web  (from web/)
npm run dev
```

Open http://localhost:3000.

## Test and build

```powershell
# Backend (from api/, venv active)
python -m pytest -v

# Frontend (from web/)
npm test

# Production build (from web/)
npm run build
```

## Demonstrate the three scenarios

**In the UI:** choose a value in **Demo scenario**, then press **Search Hotels**.

| Success | Loading state, assistant message labelled as fixture data, three hotel cards. Select one to see the summary. |
| Empty | Assistant message and a "No hotels found" panel. The form stays editable. |
| Error | An alert with the service message and a **Retry** button. |

## Fixtures

Synthetic data, exactly as supplied (`api/fixtures.py`):

```
id,name,nightlyPrice,currency,breakfastIncluded,explanation
h1,Harbour House,220,NZD,true,Within budget; breakfast included.
h2,City Garden,245,NZD,true,Near the meeting district.
h3,Quay Rooms,195,NZD,false,Lower price; breakfast costs extra.
```

The request text is validated but never interpreted. Changing the budget or dates in the message does not change the results.

## Submitted branch and commit

- Branch: `main` (all work committed directly to `main`)

## More detail

- [APPROACH.md](APPROACH.md): scope, decisions, AI-assisted development, evidence, limitations, time
- [AGENTS.md](AGENTS.md): context for AI coding agents (loaded by Claude Code through `CLAUDE.md`)
- [openapi.yaml](openapi.yaml): the API contract
