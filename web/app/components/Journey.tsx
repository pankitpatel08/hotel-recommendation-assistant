"use client";

import { useReducer, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, fetchRecommendations } from "../lib/api";
import type {
  Hotel,
  RecommendationRequest,
  RecommendationResponse,
  Scenario,
} from "../lib/api";
import { HotelCard, breakfastLabel, formatNightlyPrice } from "./HotelCard";

const EXAMPLE_MESSAGE =
  "Find a Wellington hotel for two nights, up to NZD 250 per night; breakfast preferred.";
const GENERIC_ERROR = "Something went wrong. Please try again.";

const SCENARIOS: { value: Scenario; label: string }[] = [
  { value: "success", label: "Success" },
  { value: "empty", label: "Empty" },
  { value: "error", label: "Error" },
];

// --- State ------------------------------------------------------------------
// One place describes what the page is showing. The selected hotel is stored as an id only;
// the hotel itself is looked up from the current results, so the summary can never show a
// hotel that is not in them.

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string; hotels: Hotel[] }
  | { kind: "empty"; message: string }
  | { kind: "error"; message: string; retryable: boolean };

interface State {
  status: Status;
  selectedHotelId: string | null;
  lastRequest: RecommendationRequest | null;
}

type Action =
  | { type: "submit"; request: RecommendationRequest }
  | { type: "resolved"; response: RecommendationResponse }
  | { type: "failed"; message: string; retryable: boolean }
  | { type: "select"; hotelId: string };

const initialState: State = {
  status: { kind: "idle" },
  selectedHotelId: null,
  lastRequest: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "submit":
      return {
        status: { kind: "loading" },
        selectedHotelId: null,
        lastRequest: action.request,
      };
    case "resolved": {
      const { message, hotels } = action.response;
      return {
        ...state,
        selectedHotelId: null,
        status:
          hotels.length > 0
            ? { kind: "success", message, hotels }
            : { kind: "empty", message },
      };
    }
    case "failed":
      return {
        ...state,
        selectedHotelId: null,
        status: {
          kind: "error",
          message: action.message,
          retryable: action.retryable,
        },
      };
    case "select":
      if (
        state.status.kind !== "success" ||
        !state.status.hotels.some((h) => h.id === action.hotelId)
      ) {
        return state;
      }
      return { ...state, selectedHotelId: action.hotelId };
  }
}

function statusAnnouncement(status: Status): string {
  switch (status.kind) {
    case "loading":
      return "Searching for hotels…";
    case "success":
      return `${status.hotels.length} ${status.hotels.length === 1 ? "hotel" : "hotels"} found.`;
    case "empty":
      return "No hotels found.";
    default:
      return "";
  }
}

// --- Component --------------------------------------------------------------

export default function Journey() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [message, setMessage] = useState(EXAMPLE_MESSAGE);
  const [scenario, setScenario] = useState<Scenario>("success");
  const [inputError, setInputError] = useState<string | null>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  // A ref (not state) so a double click in the same tick cannot start two requests.
  const busyRef = useRef(false);

  const { status } = state;
  const loading = status.kind === "loading";
  const hotels = status.kind === "success" ? status.hotels : [];
  const selectedHotel =
    hotels.find((h) => h.id === state.selectedHotelId) ?? null;

  async function search(request: RecommendationRequest) {
    if (busyRef.current) return;
    busyRef.current = true;
    dispatch({ type: "submit", request });
    try {
      const response = await fetchRecommendations(request);
      dispatch({ type: "resolved", response });
    } catch (error) {
      const failure = error instanceof ApiError ? error : null;
      dispatch({
        type: "failed",
        message: failure?.message ?? GENERIC_ERROR,
        retryable: failure?.retryable ?? true,
      });
    } finally {
      busyRef.current = false;
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      setInputError("Enter a hotel request before searching.");
      messageRef.current?.focus();
      return;
    }
    setInputError(null);
    void search({ message: trimmed, scenario });
  }

  function handleRetry() {
    if (state.lastRequest) void search(state.lastRequest);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Hotel Recommendation Assistant
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Describe the stay you need, review the suggestions, and choose a
          hotel.
        </p>
        <p className="mt-3 inline-block rounded-md bg-amber-50 px-3 py-1.5 text-sm text-amber-900 ring-1 ring-amber-200">
          Demo: results come from local fixture data. Nothing is booked.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        noValidate
        aria-busy={loading}
        className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6"
      >
        <label
          htmlFor="message"
          className="block text-sm font-medium text-slate-900"
        >
          Hotel request
        </label>
        <textarea
          id="message"
          ref={messageRef}
          value={message}
          rows={3}
          readOnly={loading}
          placeholder={EXAMPLE_MESSAGE}
          onChange={(event) => {
            setMessage(event.target.value);
            if (inputError) setInputError(null);
          }}
          aria-invalid={inputError ? true : undefined}
          aria-describedby={inputError ? "message-error" : undefined}
          className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 read-only:bg-slate-50"
        />
        {inputError && (
          <p
            id="message-error"
            role="alert"
            className="mt-2 text-sm font-medium text-red-700"
          >
            {inputError}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="sm:w-64">
            <label
              htmlFor="scenario"
              className="block text-sm font-medium text-slate-900"
            >
              Demo scenario
            </label>
            <select
              id="scenario"
              value={scenario}
              disabled={loading}
              onChange={(event) => setScenario(event.target.value as Scenario)}
              aria-describedby="scenario-help"
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:bg-slate-50"
            >
              {SCENARIOS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p id="scenario-help" className="mt-1 text-xs text-slate-600">
              Demo control: chooses which fixture response the API returns.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-500 sm:w-auto"
          >
            {loading ? "Searching…" : "Search Hotels"}
          </button>
        </div>
      </form>

      {/* Screen-reader announcements. Kept in the DOM so changes are announced. */}
      <p role="status" className="sr-only">
        {statusAnnouncement(status)}
      </p>

      {loading && (
        <div
          aria-hidden="true"
          className="mt-8 flex items-center gap-3 text-slate-700"
        >
          <span className="h-5 w-5 rounded-full border-2 border-slate-300 border-t-indigo-600 motion-safe:animate-spin" />
          <span>Searching for hotels…</span>
        </div>
      )}

      {status.kind === "error" && (
        <div
          role="alert"
          className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 sm:p-5"
        >
          <h2 className="font-semibold">Something went wrong</h2>
          <p className="mt-1">{status.message}</p>
          {status.retryable && (
            <button
              type="button"
              onClick={handleRetry}
              className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {(status.kind === "success" || status.kind === "empty") && (
        <section
          aria-labelledby="assistant-heading"
          className="mt-8 rounded-xl bg-indigo-50 p-4 ring-1 ring-indigo-100 sm:p-5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="assistant-heading"
              className="text-sm font-semibold uppercase tracking-wide text-indigo-900"
            >
              Assistant
            </h2>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
              Fixture data
            </span>
          </div>
          <p className="mt-2 text-slate-900">{status.message}</p>
        </section>
      )}

      {status.kind === "empty" && (
        <section
          aria-labelledby="empty-heading"
          className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center"
        >
          <h2 id="empty-heading" className="font-semibold text-slate-900">
            No hotels found
          </h2>
          <p className="mt-1 text-slate-700">
            No hotels matched this request. Edit your request or try a different
            demo scenario, then search again.
          </p>
        </section>
      )}

      {status.kind === "success" && (
        <section aria-labelledby="hotels-heading" className="mt-8">
          <h2
            id="hotels-heading"
            className="text-lg font-semibold text-slate-900"
          >
            Recommended hotels
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {status.hotels.map((hotel) => (
              <HotelCard
                key={hotel.id}
                hotel={hotel}
                selected={hotel.id === state.selectedHotelId}
                onSelect={() => dispatch({ type: "select", hotelId: hotel.id })}
              />
            ))}
          </ul>
        </section>
      )}

      {selectedHotel && (
        <section
          aria-labelledby="summary-heading"
          className="mt-8 rounded-xl border-2 border-indigo-600 bg-white p-4 sm:p-6"
        >
          <h2
            id="summary-heading"
            className="text-lg font-semibold text-slate-900"
          >
            Your selection
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-slate-600">Hotel</dt>
              <dd className="mt-1 break-words font-semibold text-slate-900">
                {selectedHotel.name}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-600">Nightly price</dt>
              <dd className="mt-1 font-semibold text-slate-900">
                {formatNightlyPrice(selectedHotel)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-600">Breakfast</dt>
              <dd className="mt-1 font-semibold text-slate-900">
                {breakfastLabel(selectedHotel)}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-slate-700">
            {selectedHotel.explanation}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Demo only: no booking has been made.
          </p>
        </section>
      )}
    </div>
  );
}
