import json
import re
import requests


# ============================================================
# OLLAMA CONFIGURATION
# ============================================================

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"

# Maximum time to wait for Ollama
OLLAMA_TIMEOUT = 180


# ============================================================
# CLEAN OLLAMA RESPONSE
# ============================================================

def clean_json_response(content: str) -> str:
    """
    Clean Ollama response and extract the JSON object.
    """

    content = content.strip()

    # Remove markdown code fences
    content = re.sub(
        r"^```json\s*",
        "",
        content,
        flags=re.IGNORECASE
    )

    content = re.sub(
        r"^```\s*",
        "",
        content
    )

    content = re.sub(
        r"\s*```$",
        "",
        content
    )

    content = content.strip()

    # Find JSON object
    start = content.find("{")
    end = content.rfind("}")

    if start == -1 or end == -1:
        raise RuntimeError(
            "Ollama response does not contain valid JSON."
        )

    return content[start:end + 1]


# ============================================================
# VALIDATE REQUEST DATA
# ============================================================

def normalize_request_data(value) -> str:
    """
    Make sure request_data is always a valid JSON string.
    """

    if isinstance(value, dict):
        return json.dumps(
            value,
            ensure_ascii=False
        )

    if isinstance(value, list):
        return json.dumps(
            value,
            ensure_ascii=False
        )

    if value is None:
        return "{}"

    value = str(value).strip()

    # Try to parse JSON strings
    try:
        parsed = json.loads(value)

        return json.dumps(
            parsed,
            ensure_ascii=False
        )

    except json.JSONDecodeError:
        # If AI returned invalid JSON text,
        # convert it into a safe JSON string.
        return json.dumps(
            value,
            ensure_ascii=False
        )


# ============================================================
# GENERATE AI TEST CASES
# ============================================================

def generate_ai_test_cases(
    method: str,
    endpoint: str,
    request_body: str = "",
    openapi_details: dict | None = None
):

    if openapi_details is None:
        openapi_details = {}

    # ========================================================
    # PREPARE OPENAPI INFORMATION
    # ========================================================

    openapi_text = json.dumps(
        openapi_details,
        indent=2,
        ensure_ascii=False
    )

    # ========================================================
    # AI PROMPT
    # ========================================================

    prompt = f"""
You are an expert API QA engineer.

Generate API test cases for the following API.

HTTP Method:
{method}

Endpoint:
{endpoint}

Request Body:
{request_body}

OpenAPI Details:
{openapi_text}

Generate exactly 8 test cases.

The test cases should cover:

1. Positive
2. Negative
3. Boundary
4. Validation
5. Security

IMPORTANT RULES:

- Return ONLY valid JSON.
- Do not return markdown.
- Do not use ```json.
- Return exactly one JSON object.
- The JSON object must contain a "test_cases" array.
- Generate exactly 8 test cases.
- Use the OpenAPI information when available.
- Do not invent fields that are not supported by the API.
- Do not invent authentication requirements unless they are present in the OpenAPI information.
- request_data MUST be a JSON string.
- request_data itself must contain valid JSON whenever the test case represents JSON data.
- Do not put unescaped double quotes inside JSON strings.
- Do not use expressions such as "* 100".
- Do not use duplicate JSON keys.
- Do not create malformed JSON.
- Keep test case descriptions clear and concise.

Each test case MUST contain:

title
method
endpoint
test_type
description
request_data
expected_result

Return this structure:

{{
  "test_cases": [
    {{
      "title": "Valid request",
      "method": "{method}",
      "endpoint": "{endpoint}",
      "test_type": "Positive",
      "description": "Verify that a valid request is accepted.",
      "request_data": "{{\\"name\\": \\"Jayasree\\", \\"email\\": \\"jayasree@example.com\\", \\"age\\": 22}}",
      "expected_result": "API should return a successful response."
    }}
  ]
}}
"""

    # ========================================================
    # CALL OLLAMA
    # ========================================================

    try:

        response = requests.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {
                    "temperature": 0.1
                }
            },
            timeout=OLLAMA_TIMEOUT
        )

    except requests.exceptions.Timeout as exc:

        raise RuntimeError(
            "Ollama took too long to generate test cases. "
            "Make sure Ollama is running correctly and "
            "the llama3.2:3b model is available."
        ) from exc

    except requests.exceptions.ConnectionError as exc:

        raise RuntimeError(
            "Could not connect to Ollama. "
            "Make sure Ollama is running on "
            "http://localhost:11434."
        ) from exc

    except requests.RequestException as exc:

        raise RuntimeError(
            f"Error while connecting to Ollama: {str(exc)}"
        ) from exc

    # ========================================================
    # CHECK HTTP RESPONSE
    # ========================================================

    if response.status_code != 200:

        raise RuntimeError(
            f"Ollama returned HTTP "
            f"{response.status_code}: "
            f"{response.text}"
        )

    # ========================================================
    # READ OLLAMA RESPONSE
    # ========================================================

    try:

        ollama_response = response.json()

    except Exception as exc:

        raise RuntimeError(
            "Ollama returned an invalid HTTP response."
        ) from exc

    content = ollama_response.get(
        "response",
        ""
    )

    if not content:

        raise RuntimeError(
            "Ollama returned an empty response."
        )

    # ========================================================
    # CLEAN RESPONSE
    # ========================================================

    content = clean_json_response(content)

    # ========================================================
    # PARSE JSON
    # ========================================================

    try:

        result = json.loads(content)

    except json.JSONDecodeError as exc:

        raise RuntimeError(
            "Ollama returned invalid JSON.\n\n"
            f"AI response:\n{content}"
        ) from exc

    # ========================================================
    # VALIDATE RESPONSE OBJECT
    # ========================================================

    if not isinstance(result, dict):

        raise RuntimeError(
            "AI response must be a JSON object."
        )

    test_cases = result.get(
        "test_cases"
    )

    if not isinstance(
        test_cases,
        list
    ):

        raise RuntimeError(
            "AI response must contain "
            "a 'test_cases' array."
        )

    # ========================================================
    # REQUIRED FIELDS
    # ========================================================

    required_fields = [
        "title",
        "method",
        "endpoint",
        "test_type",
        "description",
        "request_data",
        "expected_result"
    ]

    valid_test_cases = []

    # ========================================================
    # VALIDATE EACH TEST CASE
    # ========================================================

    for test_case in test_cases:

        if not isinstance(
            test_case,
            dict
        ):
            continue

        # Make sure required fields exist
        for field in required_fields:

            if field not in test_case:
                test_case[field] = ""

        # ----------------------------------------------------
        # Normalize values
        # ----------------------------------------------------

        test_case["title"] = str(
            test_case["title"]
        ).strip()

        test_case["method"] = str(
            test_case["method"]
        ).upper().strip()

        test_case["endpoint"] = str(
            test_case["endpoint"]
        ).strip()

        test_case["test_type"] = str(
            test_case["test_type"]
        ).strip()

        test_case["description"] = str(
            test_case["description"]
        ).strip()

        test_case["expected_result"] = str(
            test_case["expected_result"]
        ).strip()

        # ----------------------------------------------------
        # Normalize request_data
        # ----------------------------------------------------

        test_case["request_data"] = normalize_request_data(
            test_case["request_data"]
        )

        valid_test_cases.append(
            test_case
        )

    # ========================================================
    # FINAL VALIDATION
    # ========================================================

    if not valid_test_cases:

        raise RuntimeError(
            "AI did not generate any valid test cases."
        )

    return valid_test_cases