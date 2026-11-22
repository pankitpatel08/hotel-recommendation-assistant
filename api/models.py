"""Pydantic models. Each one mirrors a schema in openapi.yaml (the source of truth)."""

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class Scenario(str, Enum):
    """Demo control that selects the fixture response."""

    success = "success"
    empty = "empty"
    error = "error"


class RecommendationRequest(BaseModel):
    message: str = Field(min_length=1)
    scenario: Scenario = Scenario.success

    @field_validator("message")
    @classmethod
    def message_must_contain_text(cls, value: str) -> str:
        # Same rule as the contract's `pattern: \S`: at least one non-whitespace character.
        if not value.strip():
            raise ValueError("message must contain at least one non-whitespace character")
        return value


class Hotel(BaseModel):
    # Field names are camelCase on purpose: they are the wire names in the contract.
    id: str
    name: str
    nightlyPrice: float = Field(ge=0)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    breakfastIncluded: bool
    explanation: str


class RecommendationResponse(BaseModel):
    message: str
    hotels: list[Hotel]


class ErrorResponse(BaseModel):
    code: Literal["validation_error", "service_unavailable"]
    message: str = Field(min_length=1)