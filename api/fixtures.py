"""Deterministic, synthetic fixture data for the demo API.

Hotel values are exactly those supplied in the assessment. This module is
plain data on purpose: no framework imports, so it is easy to read and check.
"""

SUCCESS_MESSAGE = "Demo fixture data: here are three Wellington hotels."
EMPTY_MESSAGE = "Demo fixture data: no hotels matched this request."
ERROR_MESSAGE = "The recommendation service is temporarily unavailable. Please try again."

# id,name,nightlyPrice,currency,breakfastIncluded,explanation
HOTELS = [
    {
        "id": "h1",
        "name": "Harbour House",
        "nightlyPrice": 220,
        "currency": "NZD",
        "breakfastIncluded": True,
        "explanation": "Within budget; breakfast included.",
    },
    {
        "id": "h2",
        "name": "City Garden",
        "nightlyPrice": 245,
        "currency": "NZD",
        "breakfastIncluded": True,
        "explanation": "Near the meeting district.",
    },
    {
        "id": "h3",
        "name": "Quay Rooms",
        "nightlyPrice": 195,
        "currency": "NZD",
        "breakfastIncluded": False,
        "explanation": "Lower price; breakfast costs extra.",
    },
]