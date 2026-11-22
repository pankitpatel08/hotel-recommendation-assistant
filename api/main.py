"""Hotel recommendations demo API. Contract: ../openapi.yaml

Run (from this folder, venv active):  uvicorn main:app --reload --port 8000
"""

import os
from asyncio import sleep

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from fixtures import EMPTY_MESSAGE, ERROR_MESSAGE, HOTELS, SUCCESS_MESSAGE
from models import ErrorResponse, RecommendationRequest, RecommendationResponse, Scenario

app = FastAPI(title="Hotel Recommendations API (fixture demo)", version="0.1.0")

# CORS: allow the local Next.js dev server only. Override with CORS_ORIGINS (comma-separated).
_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins.split(",") if o.strip()],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)


def _delay_seconds() -> float:
    """Demo delay from FIXTURE_DELAY_MS (default 800). Read per request so tests can set it."""
    try:
        return max(0.0, float(os.getenv("FIXTURE_DELAY_MS", "800"))) / 1000
    except ValueError:
        return 0.8


def _validation_message(exc: RequestValidationError) -> str:
    """Turn the first Pydantic error into one readable sentence."""
    errors = exc.errors()
    first = errors[0] if errors else {}
    loc = first.get("loc", ())
    field = loc[1] if len(loc) > 1 else None

    if field == "message":
        if first.get("type") == "missing":
            return "Message is required."
        if first.get("type") == "string_type":
            return "Message must be text."
        return "Message must not be empty."
    if field == "scenario":
        return "Scenario must be one of: success, empty, error."
    return "Request body must be valid JSON containing a message."


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Replace FastAPI's default {"detail": [...]} so every error has the contract's {code, message} shape.
    body = ErrorResponse(code="validation_error", message=_validation_message(exc))
    return JSONResponse(status_code=422, content=body.model_dump())


@app.post(
    "/recommendations",
    response_model=RecommendationResponse,
    responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
)
async def create_recommendations(request: RecommendationRequest):
    # By the time we are here the request is valid (validation runs first), so an
    # invalid message with scenario=error returns 422, not 503.
    await sleep(_delay_seconds())

    if request.scenario is Scenario.error:
        body = ErrorResponse(code="service_unavailable", message=ERROR_MESSAGE)
        return JSONResponse(status_code=503, content=body.model_dump())

    if request.scenario is Scenario.empty:
        return RecommendationResponse(message=EMPTY_MESSAGE, hotels=[])

    return RecommendationResponse(message=SUCCESS_MESSAGE, hotels=HOTELS)