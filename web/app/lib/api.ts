// API types and client. Mirrors ../../openapi.yaml (the source of truth).
// No React in this file: the UI imports from here, never the other way round.

export type Scenario = "success" | "empty" | "error";

export interface Hotel {
  id: string;
  name: string;
  nightlyPrice: number;
  currency: string;
  breakfastIncluded: boolean;
  explanation: string;
}

export interface RecommendationRequest {
  message: string;
  scenario: Scenario;
}

export interface RecommendationResponse {
  message: string;
  hotels: Hotel[];
}

export type ApiErrorKind =
  | "validation"
  | "unavailable"
  | "network"
  | "invalid_response";

export class ApiError extends Error {
  kind: ApiErrorKind;
  // A repeat of the same request can only help if the problem was not the request itself.
  retryable: boolean;

  constructor(kind: ApiErrorKind, message: string) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.retryable = kind !== "validation";
  }
}

const DEFAULT_BASE_URL = "http://localhost:8000";
const NETWORK_MESSAGE =
  "We could not reach the recommendation service. Check that the API is running, then try again.";
const INVALID_RESPONSE_MESSAGE =
  "The recommendation service sent an unexpected response. Please try again.";
const UNAVAILABLE_FALLBACK =
  "The recommendation service is temporarily unavailable. Please try again.";
const VALIDATION_FALLBACK =
  "The request was not accepted. Please check it and try again.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHotel(value: unknown): value is Hotel {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.nightlyPrice === "number" &&
    typeof value.currency === "string" &&
    typeof value.breakfastIncluded === "boolean" &&
    typeof value.explanation === "string"
  );
}

function isRecommendationResponse(
  value: unknown,
): value is RecommendationResponse {
  return (
    isRecord(value) &&
    typeof value.message === "string" &&
    Array.isArray(value.hotels) &&
    value.hotels.every(isHotel)
  );
}

// The API's error body is { code, message }. Use its message when present.
function serverMessage(body: unknown, fallback: string): string {
  return isRecord(body) && typeof body.message === "string" && body.message
    ? body.message
    : fallback;
}

export async function fetchRecommendations(
  request: RecommendationRequest,
): Promise<RecommendationResponse> {
  const baseUrl = (
    process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_BASE_URL
  ).replace(/\/+$/, "");

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new ApiError("network", NETWORK_MESSAGE);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null; // not JSON: handled below according to the status
  }

  if (response.ok) {
    if (isRecommendationResponse(body)) return body;
    throw new ApiError("invalid_response", INVALID_RESPONSE_MESSAGE);
  }
  if (response.status === 422) {
    throw new ApiError("validation", serverMessage(body, VALIDATION_FALLBACK));
  }
  throw new ApiError("unavailable", serverMessage(body, UNAVAILABLE_FALLBACK));
}
