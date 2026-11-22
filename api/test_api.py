"""API tests. Run from this folder with the venv active:  pytest -v

The contract tests read ../openapi.yaml and check real responses against it.
"""

from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

import main

SPEC = yaml.safe_load((Path(__file__).resolve().parent.parent / "openapi.yaml").read_text(encoding="utf-8"))
DOCUMENTED = SPEC["paths"]["/recommendations"]["post"]["responses"]

MESSAGE = "Find a Wellington hotel for two nights, up to NZD 250 per night; breakfast preferred."

# Literal copy of the assessment CSV. Deliberately NOT imported from fixtures.py,
# so these tests would catch an accidental change to the fixture file.
EXPECTED_HOTELS = [
    {"id": "h1", "name": "Harbour House", "nightlyPrice": 220, "currency": "NZD",
     "breakfastIncluded": True, "explanation": "Within budget; breakfast included."},
    {"id": "h2", "name": "City Garden", "nightlyPrice": 245, "currency": "NZD",
     "breakfastIncluded": True, "explanation": "Near the meeting district."},
    {"id": "h3", "name": "Quay Rooms", "nightlyPrice": 195, "currency": "NZD",
     "breakfastIncluded": False, "explanation": "Lower price; breakfast costs extra."},
]
HOTEL_FIELDS = {"id", "name", "nightlyPrice", "currency", "breakfastIncluded", "explanation"}


@pytest.fixture(autouse=True)
def no_delay(monkeypatch):
    monkeypatch.setenv("FIXTURE_DELAY_MS", "0")


@pytest.fixture()
def client():
    return TestClient(main.app)


def post(client, scenario=None, message=MESSAGE):
    body = {"message": message}
    if scenario is not None:
        body["scenario"] = scenario
    return client.post("/recommendations", json=body)


def assert_error(resp, status, code, message=None):
    assert resp.status_code == status
    body = resp.json()
    assert set(body) == {"code", "message"}
    assert body["code"] == code
    assert isinstance(body["message"], str) and body["message"]
    if message is not None:
        assert body["message"] == message


# --- success -----------------------------------------------------------------

def test_success_returns_assistant_message_labelled_as_fixture(client):
    resp = post(client, "success")
    assert resp.status_code == 200
    body = resp.json()
    assert "fixture" in body["message"].lower()
    assert len(body["hotels"]) == 3


def test_success_returns_all_three_fixtures_exactly(client):
    assert post(client, "success").json()["hotels"] == EXPECTED_HOTELS


def test_success_response_schema_and_types(client):
    body = post(client, "success").json()
    assert set(body) == {"message", "hotels"}
    assert isinstance(body["message"], str)
    for hotel in body["hotels"]:
        assert set(hotel) == HOTEL_FIELDS
        assert isinstance(hotel["id"], str)
        assert isinstance(hotel["name"], str)
        assert isinstance(hotel["nightlyPrice"], (int, float)) and not isinstance(hotel["nightlyPrice"], bool)
        assert isinstance(hotel["currency"], str)
        assert isinstance(hotel["breakfastIncluded"], bool)
        assert isinstance(hotel["explanation"], str)


def test_scenario_defaults_to_success_when_omitted(client):
    assert post(client).json()["hotels"] == EXPECTED_HOTELS


# --- empty and error ---------------------------------------------------------

def test_empty_scenario_returns_message_and_no_hotels(client):
    resp = post(client, "empty")
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == {"message", "hotels"}
    assert body["hotels"] == []
    assert body["message"]


def test_error_scenario_returns_503_with_structured_message(client):
    assert_error(post(client, "error"), 503, "service_unavailable")


# --- validation --------------------------------------------------------------

@pytest.mark.parametrize("message", ["", " ", "   \t\n  "], ids=["empty", "space", "mixed-whitespace"])
def test_blank_message_is_rejected(client, message):
    assert_error(post(client, "success", message=message), 422, "validation_error", "Message must not be empty.")


@pytest.mark.parametrize(
    "payload",
    [{}, {"scenario": "success"}, {"message": None}, {"message": 123}],
    ids=["no-body-fields", "message-missing", "message-null", "message-not-text"],
)
def test_missing_or_non_text_message_is_rejected(client, payload):
    assert_error(client.post("/recommendations", json=payload), 422, "validation_error")


@pytest.mark.parametrize("scenario", ["bogus", "SUCCESS", ""], ids=["unknown", "wrong-case", "empty-string"])
def test_invalid_scenario_is_rejected(client, scenario):
    assert_error(post(client, scenario), 422, "validation_error", "Scenario must be one of: success, empty, error.")


def test_malformed_json_is_rejected_with_the_standard_error_shape(client):
    resp = client.post("/recommendations", content="{not json", headers={"Content-Type": "application/json"})
    assert_error(resp, 422, "validation_error")


def test_validation_takes_precedence_over_error_scenario(client):
    # Blank message + scenario=error must be 422, never 503.
    assert_error(post(client, "error", message="   "), 422, "validation_error")


# --- delay and CORS ----------------------------------------------------------

def test_delay_is_applied_to_valid_requests_only(client, monkeypatch):
    slept = []

    async def fake_sleep(seconds):
        slept.append(seconds)

    monkeypatch.setattr(main, "sleep", fake_sleep)
    monkeypatch.setenv("FIXTURE_DELAY_MS", "250")

    post(client, "success", message="   ")  # invalid: must not wait
    assert slept == []
    post(client, "success")
    assert slept == [0.25]


def test_cors_allows_local_next_origin(client):
    resp = client.options(
        "/recommendations",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert resp.status_code == 200
    assert resp.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "POST" in resp.headers["access-control-allow-methods"]


def test_cors_rejects_other_origins(client):
    resp = client.options(
        "/recommendations",
        headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in resp.headers


# --- contract conformance (against ../openapi.yaml) ---------------------------

def validate_against(schema_name, body):
    # Wrap the schema so "#/components/schemas/..." refs resolve against the real spec.
    schema = {"$ref": f"#/components/schemas/{schema_name}", "components": SPEC["components"]}
    Draft202012Validator(schema).validate(body)


CASES = [
    ("success", MESSAGE, 200, "RecommendationResponse"),
    ("empty", MESSAGE, 200, "RecommendationResponse"),
    ("error", MESSAGE, 503, "ErrorResponse"),
    ("success", "   ", 422, "ErrorResponse"),
    ("bogus", MESSAGE, 422, "ErrorResponse"),
]


@pytest.mark.parametrize("scenario,message,status,schema", CASES, ids=["success", "empty", "error", "blank", "bad-scenario"])
def test_real_responses_validate_against_openapi_schemas(client, scenario, message, status, schema):
    resp = post(client, scenario, message=message)
    assert resp.status_code == status
    assert str(status) in DOCUMENTED  # the status code is documented
    validate_against(schema, resp.json())


def test_documented_status_codes_are_exactly_200_422_503():
    assert set(DOCUMENTED) == {"200", "422", "503"}


def test_documented_examples_match_actual_responses(client):
    json_200 = DOCUMENTED["200"]["content"]["application/json"]["examples"]
    assert post(client, "success").json() == json_200["success"]["value"]
    assert post(client, "empty").json() == json_200["empty"]["value"]
    assert post(client, "error").json() == DOCUMENTED["503"]["content"]["application/json"]["example"]
    assert post(client, "success", message=" ").json() == DOCUMENTED["422"]["content"]["application/json"]["example"]