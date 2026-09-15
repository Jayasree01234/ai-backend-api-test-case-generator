import json
import re
import requests


# ============================================================
# OLLAMA CONFIGURATION
# ============================================================

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"
OLLAMA_TIMEOUT = 300


# ============================================================
# CLEAN OLLAMA RESPONSE
# ============================================================

def clean_json_response(content: str) -> str:
    """
    Removes markdown/code fences and extracts the JSON object
    from Ollama's response.
    """

    if not content:
        raise RuntimeError("Ollama returned an empty response.")

    content = content.strip()

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

    start = content.find("{")
    end = content.rfind("}")

    if start == -1 or end == -1 or end <= start:
        raise RuntimeError(
            "Ollama response does not contain valid JSON."
        )

    return content[start:end + 1]


# ============================================================
# NORMALIZE REQUEST DATA
# ============================================================

def normalize_request_data(value):
    """
    Converts request_data into a valid JSON string.
    """

    if value is None:
        return "{}"

    if isinstance(value, (dict, list)):
        return json.dumps(
            value,
            separators=(",", ":")
        )

    value = str(value).strip()

    if not value:
        return "{}"

    try:
        parsed = json.loads(value)

        return json.dumps(
            parsed,
            separators=(",", ":")
        )

    except json.JSONDecodeError:
        pass

    # Small repair for duplicated quotation marks.
    repaired = re.sub(
        r'""+',
        '"',
        value
    )

    try:
        parsed = json.loads(repaired)

        return json.dumps(
            parsed,
            separators=(",", ":")
        )

    except json.JSONDecodeError:
        pass

    return json.dumps(value)


# ============================================================
# VALIDATE TEST CASE
# ============================================================

def validate_test_case(test_case: dict) -> bool:
    """
    Checks whether an AI-generated test case contains all
    required fields.
    """

    required_fields = [
        "title",
        "method",
        "endpoint",
        "test_type",
        "description",
        "request_data",
        "expected_result"
    ]

    for field in required_fields:

        if field not in test_case:
            return False

    return True


# ============================================================
# NORMALIZE TEST TYPE
# ============================================================

def normalize_test_type(value: str) -> str:
    """
    Converts AI-generated test type names into standard
    categories.
    """

    value = str(value).strip().lower()

    if "positive" in value:
        return "Positive"

    if "negative" in value:
        return "Negative"

    if "boundary" in value:
        return "Boundary"

    if "validation" in value:
        return "Validation"

    if "security" in value:
        return "Security"

    return value.title() if value else "Functional"


# ============================================================
# SANITIZE TEST CASE
# ============================================================

def sanitize_test_case(
    test_case: dict,
    method: str,
    endpoint: str
) -> dict:
    """
    Cleans one AI-generated test case.
    """

    cleaned = {}

    cleaned["title"] = str(
        test_case.get(
            "title",
            "Generated API Test"
        )
    ).strip()

    cleaned["method"] = str(
        test_case.get(
            "method",
            method
        )
    ).upper().strip()

    cleaned["endpoint"] = str(
        test_case.get(
            "endpoint",
            endpoint
        )
    ).strip()

    cleaned["test_type"] = normalize_test_type(
        test_case.get(
            "test_type",
            "Functional"
        )
    )

    cleaned["description"] = str(
        test_case.get(
            "description",
            "Verify API behavior."
        )
    ).strip()

    cleaned["request_data"] = normalize_request_data(
        test_case.get(
            "request_data",
            "{}"
        )
    )

    cleaned["expected_result"] = str(
        test_case.get(
            "expected_result",
            "API should return the expected response."
        )
    ).strip()

    if "expected_status_code" in test_case:

        try:

            status_code = int(
                test_case["expected_status_code"]
            )

            if 100 <= status_code <= 599:

                cleaned["expected_status_code"] = (
                    status_code
                )

        except (TypeError, ValueError):
            pass

    return cleaned


# ============================================================
# REMOVE DUPLICATE TEST CASES
# ============================================================

def remove_duplicate_test_cases(
    test_cases: list
) -> list:
    """
    Removes duplicate AI-generated test cases.
    """

    unique_cases = []
    seen = set()

    for test_case in test_cases:

        key = (
            test_case.get("method", ""),
            test_case.get("endpoint", ""),
            test_case.get("test_type", ""),
            test_case.get("title", "").lower()
        )

        if key in seen:
            continue

        seen.add(key)
        unique_cases.append(test_case)

    return unique_cases


# ============================================================
# GENERATE AI TEST CASES
# ============================================================

def generate_ai_test_cases(
    method: str,
    endpoint: str,
    request_body: str = "",
    openapi_details: dict | None = None
):
    """
    OLLAMA AI GENERATION PIPELINE.

    Responsibilities of this file:

    1. Create the AI prompt.
    2. Send the prompt to Ollama.
    3. Generate API test cases.
    4. Cover Positive, Negative, Boundary,
       Validation and Security scenarios.
    5. Validate the AI response.
    6. Clean and normalize the generated data.

    This function DOES NOT execute API tests.
    """

    if openapi_details is None:
        openapi_details = {}

    method = str(
        method
    ).upper().strip()

    endpoint = str(
        endpoint
    ).strip()

    request_body = str(
        request_body or ""
    )

    try:

        openapi_json = json.dumps(
            openapi_details,
            indent=2
        )

    except Exception:

        openapi_json = "{}"


    # ========================================================
    # AI PROMPT
    # ========================================================

    prompt = f"""
You are an expert API QA engineer.

Generate high-quality API test cases for ONLY the API
provided below.

HTTP Method:
{method}

Endpoint:
{endpoint}

Request Body:
{request_body}

OpenAPI Details:
{openapi_json}

Generate between 8 and 15 test cases.

The test cases should cover these categories whenever
they are meaningful for this API:

1. Positive
2. Negative
3. Boundary
4. Validation
5. Security

IMPORTANT RULES:

1. Return ONLY valid JSON.

2. Do not return markdown.

3. Do not return code fences.

4. The top-level object MUST contain:
   "test_cases"

5. "test_cases" MUST be an array.

6. Every test case MUST contain:

   title
   method
   endpoint
   test_type
   description
   request_data
   expected_result

7. request_data MUST be a STRING containing valid JSON.

8. For GET requests without a request body use:

   "{{}}"

9. Use realistic values.

10. Use actual numeric boundary values.

11. NEVER use expressions such as:

   minimum + 1
   maximum - 1
   * 100
   random value

12. Use actual values instead.

13. Use OpenAPI information whenever available.

14. Do not invent fields that are not supported by the API.

15. Do not invent additional endpoints.

16. Do not change the HTTP method.

17. Path parameters must use realistic concrete values.

18. Keep descriptions short and clear.

19. Security tests must be safe QA tests.

20. Do not perform destructive actions.

21. If expected_status_code is provided, it MUST be an
    integer between 100 and 599.

22. Do not generate malformed JSON.

23. For positive tests, use valid input.

24. For negative tests, use invalid input or invalid
    conditions supported by the API.

25. For boundary tests, use actual minimum or maximum
    values from OpenAPI when available.

26. For validation tests, test missing, invalid, or
    incorrectly formatted values when meaningful.

27. For security tests, test safe authentication,
    authorization, or input-validation scenarios.

Return this structure:

{{
    "test_cases": [
        {{
            "title": "Valid request",
            "method": "{method}",
            "endpoint": "{endpoint}",
            "test_type": "Positive",
            "description": "Verify that a valid request is accepted.",
            "request_data": "{{\\\"name\\\":\\\"Jayasree\\\",\\\"email\\\":\\\"jayasree@example.com\\\"}}",
            "expected_result": "API should return a successful response.",
            "expected_status_code": 200
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

    except requests.RequestException as exc:

        raise RuntimeError(
            "Could not connect to Ollama. "
            "Make sure Ollama is running."
        ) from exc


    # ========================================================
    # CHECK HTTP STATUS
    # ========================================================

    if response.status_code != 200:

        raise RuntimeError(
            f"Ollama returned HTTP "
            f"{response.status_code}: "
            f"{response.text}"
        )


    # ========================================================
    # PARSE OLLAMA HTTP RESPONSE
    # ========================================================

    try:

        ollama_response = response.json()

    except Exception as exc:

        raise RuntimeError(
            "Ollama returned an invalid HTTP response."
        ) from exc


    # ========================================================
    # GET AI CONTENT
    # ========================================================

    content = ollama_response.get(
        "response",
        ""
    )

    if not content:

        raise RuntimeError(
            "Ollama returned an empty response."
        )


    # ========================================================
    # CLEAN JSON
    # ========================================================

    content = clean_json_response(
        content
    )


    # ========================================================
    # PARSE JSON
    # ========================================================

    try:

        result = json.loads(
            content
        )

    except json.JSONDecodeError as exc:

        raise RuntimeError(
            "Ollama returned invalid JSON.\n\n"
            f"AI response:\n{content}"
        ) from exc


    # ========================================================
    # VALIDATE TOP LEVEL
    # ========================================================

    if not isinstance(
        result,
        dict
    ):

        raise RuntimeError(
            "AI response must be a JSON object."
        )


    # ========================================================
    # GET TEST CASES
    # ========================================================

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
    # PROCESS TEST CASES
    # ========================================================

    valid_test_cases = []

    for test_case in test_cases:

        if not isinstance(
            test_case,
            dict
        ):
            continue

        if not validate_test_case(
            test_case
        ):
            continue

        cleaned_case = sanitize_test_case(
            test_case,
            method,
            endpoint
        )

        valid_test_cases.append(
            cleaned_case
        )


    # ========================================================
    # REMOVE DUPLICATES
    # ========================================================

    valid_test_cases = remove_duplicate_test_cases(
        valid_test_cases
    )


    # ========================================================
    # FINAL VALIDATION
    # ========================================================

    if not valid_test_cases:

        raise RuntimeError(
            "AI did not generate any valid test cases."
        )


    # ========================================================
    # RETURN
    # ========================================================

    return valid_test_cases