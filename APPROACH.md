# APPROACH

## 1. Scope

**Customer outcome:** a traveller enters a hotel request, reviews the assistant's recommendations, and selects one hotel.

**Built**

- One page: request form, demo scenario control, loading indicator, assistant message, hotel cards, one selection with a summary.
- Empty-result state, recoverable error state with Retry, inline validation for an empty message.
- `POST /recommendations` with validation, three scenarios, and fixture data only.
- Small-screen layout, keyboard access, accessible labels, visible focus.

**Not built (by design):** natural-language interpretation, budget or breakfast filtering, totals, live model, streaming, scraping,
booking, persistence of the selection, authentication, database, deployment, browser end-to-end tests, CI, generated API clients.

## 2. Assumptions

- Work is committed directly to `main`. The brief asks only that the submitted branch and commit be recorded.
- `scenario` is a demo control, not part of a real product contract.
- The three fixtures are returned in the supplied order.
- The fixture label lives in the assistant `message` text and in a UI badge. The response shape stays exactly `{message, hotels}`.
- A long message is accepted. There is no length cap.

## 3. Architecture decisions

| Decision                                                                  | Alternative               | Why                                                                                                                                                 |
| ------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two independent processes, direct CORS call                               | Next.js proxy route       | Simpler, and the contract is visible in the network tab. CORS misconfiguration is a documented setup risk.                                          |
| `useReducer` and `useState` in one client component                       | Redux, Zustand            | One screen with one owner of the state. A library adds a dependency and boilerplate for no gain. Revisit if several pages must share the selection. |
| Selected hotel stored as an id only; hotel looked up from current results | Copy the hotel into state | The summary can never show a hotel that is not in the current results. Every new search clears the selection.                                       |
| API client and types in `api.ts`, no React inside                         | Fetch inside components   | UI and communication are separate and the client is easy to test.                                                                                   |
| Types written by hand from the OpenAPI schemas                            | Code generation           | No extra tooling for three schemas.                                                                                                                 |
| `page.tsx` is a server component that renders the client `Journey`        | Everything client-side    | The shell is static. Only the interactive part is a client component.                                                                               |
| System font stack, no `next/font`                                         | Scaffold's Google font    | Avoids a network fetch at build time.                                                                                                               |
| Plain `venv` with a pinned `requirements.txt`                             | uv or pyproject           | Simplest for a reviewer.                                                                                                                            |

## 4. API contract decisions

The source of truth is [`openapi.yaml`](openapi.yaml). It was drafted and reviewed before any backend code was written.

| Decision                                          | Alternative                       | Why                                                                                               |
| ------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `scenario` optional, default `success`            | Required                          | Friendlier to manual calls. Documented in the contract.                                           |
| One error shape `{code, message}` for 422 and 503 | FastAPI default `{detail: [...]}` | One format for the frontend to parse. Needs a custom handler for `RequestValidationError`.        |
| Validation before scenario handling               | Scenario first                    | A blank message with `scenario=error` returns 422, not 503. This is what a real service would do. |
| Delay on every valid request, not only success    | Success only                      | The loading state can be shown in all three scenarios. The brief only requires it for success.    |
| `currency` pattern `^[A-Z]{3}$`                   | Plain string                      | A small extra rule the fixtures satisfy.                                                          |
| `nightlyPrice` modelled as a float                | int                               | The contract says `number`. JSON may therefore show `220.0` instead of `220`. Both are valid.     |
| Only `POST /recommendations` is documented        | Document 404 and 405              | Other paths and methods return FastAPI's default `{detail}`, which is outside the contract.       |

### Contract revisions

| Change                                                                                                                | Reason                                                                                           |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Initial `openapi.yaml` v0.1.0, reviewed before implementation                                                         | Contract-first                                                                                   |
| Two multi-line `description` blocks changed to quoted single-line strings. No schema, status code or example changed. | After being pasted into the repo, the file failed to parse (found when Pytest tried to load it). |

## 5. Trade-offs

| Decision                                                | Cost                                                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Message box is a `<textarea>`                           | Enter inserts a newline, so keyboard submission is Tab to the button, then Enter or Space.                         |
| Search button is `disabled` while loading               | Browsers can drop focus from a disabled button. Predicted, **not yet confirmed** (see section 9).                  |
| No `AbortController`                                    | Not needed. A ref guard plus the disabled button mean two requests can never overlap. Aborting would be dead code. |
| Retry re-sends the last request, including its scenario | After an `error` scenario, Retry repeats the error. Recovery is shown by restarting the API.                       |
| Summary appears below the cards                         | On a small screen it can be off screen after choosing one of the upper cards.                                      |
| Separate `fixtures.py` and `models.py`                  | More files than the first plan, added at the author's request for clearer separation.                              |
| Tests live beside the component                         | Not in a separate tests folder.                                                                                    |

## 6. AI-assisted development

### 6.1 Tool and context file

The AI assistant was used through the **Claude chat interface**, which proposed designs and generated code, and the author
pasted that code into VS Code and ran it locally.

### 6.2 Representative directions

**Exact excerpts** are verbatim from the author's prompts. The summaries of what the AI did are **retrospective**.

**Direction 1: plan before code** (exact excerpts from the first prompt)

> "Before writing any code, carefully analyse the requirements below."

_Retrospective summary:_ the AI returned a requirements breakdown, acceptance criteria, edge cases, architecture, test list,
manual checks, and six open decisions. I have confirmed the decisions before anything was built.
_Accepted:_ the `{code, message}` error shape, `aria-pressed` Select buttons, scenario defaulting to `success`,
the fixture label in the message, and a plain `venv`.
_Why it mattered:_ the contract and the validation-before-scenario rule were settled before code existed.

### 6.3 AI suggestions accepted (retrospective)

- Plan-first workflow, contract-first OpenAPI, and the commit sequence.
- `useReducer` with a status union and an id-only selection.
- A separate API client with a runtime shape check on responses.
- Tests derived from the requirements, with `fetch` mocked, and an OpenAPI conformance test on the backend.

### 6.4 Challenged, corrected or redirected (retrospective)

| What happened                                                                                                   | Outcome                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| The author chose to commit directly to `main`.                                                                  | The AI agreed this fits the brief and moved branch recording into the README.                                                                |
| The AI-provided `openapi.yaml` failed to parse on the author's machine. The AI had validated only its own copy. | Block-scalar descriptions were rewritten as quoted strings and the AI stated that its earlier "parses" result had not covered the repo copy. |
| Vitest failed 11 of 11 on first run: two copies of React from a stray install at the repo root.                 | Diagnosed from the stack trace and fixed by removing the root install and reinstalling inside `web/`.                                        |
| The AI's keyboard checklist assumed "Enter to submit" from the message box.                                     | Corrected: the box is a `<textarea>`, so Enter adds a newline (section 5).                                                                   |

## 7. Testing and evidence

### 7.1 Strategy

Checks are derived from the requirements. Frontend tests mock `fetch`. Backend tests call the real app in-process and validate
responses against `openapi.yaml`.

| Requirement                                                          | Check                                                                                                                   |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Initial render, heading, example text, scenario options              | Vitest: "shows the heading, the example request, the scenario control and the search button"                            |
| Empty input validation                                               | Vitest: "rejects a blank message…"; Pytest: blank, missing and non-text message cases                                   |
| Loading state, no duplicate submit                                   | Vitest: "shows loading, disables the button, and does not send a duplicate request"                                     |
| Selection by keyboard, summary, replacement, cleared by a new search | Vitest: "selects with the keyboard…", "clears the selection…"                                                           |
| Empty scenario                                                       | Vitest and Pytest (`hotels: []`)                                                                                        |
| 503, Retry, unreachable API, malformed 200, 422                      | Vitest: four tests in `failures`; Pytest: 503 and 422 cases                                                             |
| Exact fixtures and response types                                    | Pytest: literal copy of the assessment CSV compared to the response; type checks                                        |
| Invalid scenario, malformed JSON, validation before scenario         | Pytest                                                                                                                  |
| Contract conformance                                                 | Pytest: real responses validated against the schemas, documented status codes, documented examples equal real responses |
| Delay and CORS                                                       | Pytest: delay applied only to valid requests; preflight allowed for the local web origin only                           |

### 7.2 Results observed

| Check                                                                                                                 | Result                                                                  | Evidence                                  |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------- |
| Pytest, first run                                                                                                     | **Failed**: collection error, `openapi.yaml` would not parse            | Changes in the yaml fiel for description. |
| Pytest, final run                                                                                                     | -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html |
| =========================================== 28 passed, 1 warning in 2.85s =========================================== |                                                                         |
| `npm run lint`                                                                                                        | > web@0.1.0 lint                                                        |
| > eslint                                                                                                              |

### 7.3 Evidence artefacts

Added Screenshots in the folder `Testing_Screenshots`

## 8. Mock boundaries

- All hotel data is a local fixture. Nothing is searched, filtered or priced.
- The `message` is validated and then ignored. Changing the budget, dates or city has no effect.
- `scenario` exists only to demonstrate states. The delay is simulated.
- The "assistant" is a fixed string. There is no model.
- Selecting a hotel changes only in-memory state. It is lost on refresh and no booking is made. The UI says so.
- Responses are labelled as fixture data in the message and with a badge.

## 9. Incomplete work

- I think covered all the cases

## 10. Time spent

| Step                                  | Actual  |
| ------------------------------------- | ------- |
| Requirement analysis                  | 20 Min  |
| Architecture and API contract         | 25 Min  |
| Backend development                   | 30 Min  |
| Frontend Development                  | 50 Min  |
| Fixing environment and setup problems | 20 Min  |
| Testing,verification and evidence     | 35 Min  |
| Documentation                         | 40 Min  |
| **Total**                             | 220 Min |
