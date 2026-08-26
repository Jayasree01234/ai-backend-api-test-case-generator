import json
import re
import requests


# ============================================================
# OLLAMA CONFIGURATION
# ============================================================

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"


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

    # Remove ```json and ```
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

    if start == -1 or end == -1 or end <= start:
        raise RuntimeError(
            "Ollama response does not contain valid JSON."
        )

    return content[start:end + 1]


# ============================================================
# REPAIR REQUEST DATA
# ============================================================

def normalize_request_data(value) -> str:
    """
    Makes sure request_data is always stored as a valid JSON string.

    Examples:
        dict -> JSON string
        list -> JSON string
        string containing valid JSON -> cleaned JSON string
        invalid string -> safely converted to a JSON string
    """

    # --------------------------------------------------------
    # If Ollama returned a dictionary/list
    # --------------------------------------------------------

    if isinstance(value, (dict, list)):
        return json.dumps(
            value,
            separators=(",", ":")
        )

    # --------------------------------------------------------
    # Convert anything else to string
    # --------------------------------------------------------

    if value is None:
        return "{}"

    value = str(value).strip()

    if not value:
        return "{}"

    # --------------------------------------------------------
    # Try parsing the string as JSON
    # --------------------------------------------------------

    try:
        parsed = json.loads(value)

        return json.dumps(
            parsed,
            separators=(",", ":")
        )

    except json.JSONDecodeError:
        pass

    # --------------------------------------------------------
    # Sometimes small local models generate malformed JSON
    # inside the request_data string.
    #
    # Example:
    # {"name":"Jayasree@""}
    #
    # Try removing duplicated quotes.
    # --------------------------------------------------------

    repaired = value

    repaired = re.sub(
        r'""+',
        '"',
        repaired
    )

    # --------------------------------------------------------
    # Try again
    # --------------------------------------------------------

    try:
        parsed = json.loads(repaired)

        return json.dumps(
            parsed,
            separators=(",", ":")
        )

    except json.JSONDecodeError:
        pass

    # --------------------------------------------------------
    # If it is still invalid, safely store it as a JSON string.
    #
    # This guarantees that the database receives valid JSON text.
    # --------------------------------------------------------

    return json.dumps(
        value
    )


# ============================================================
# VALIDATE TEST CASE
# ============================================================

def validate_test_case(test_case: dict) -> bool:
    """
    Checks whether the AI generated a usable test case.
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
# GENERATE AI TEST CASES
# ============================================================

def generate_ai_test_cases(
    method: str,
    endpoint: str,
    request_body: str = "",
    openapi_details: dict | None = None
):
    """
    Generate API test cases using Ollama.
    """

    if openapi_details is None:
        openapi_details = {}

    method = str(method).upper()
    endpoint = str(endpoint)

    # --------------------------------------------------------
    # Prepare OpenAPI information
    # --------------------------------------------------------

    try:
        openapi_json = json.dumps(
            openapi_details,
            indent=2
        )

    except Exception:
        openapi_json = "{}"

    # --------------------------------------------------------
    # PROMPT
    # --------------------------------------------------------

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
{openapi_json}

Generate between 8 and 15 test cases.

Test case categories should include:

1. Positive
2. Negative
3. Boundary
4. Validation
5. Security

IMPORTANT RULES:

1. Return ONLY valid JSON.
2. Do NOT return markdown.
3. Do NOT use ```json.
4. The response must start with {{ and end with }}.
5. The top-level object must contain "test_cases".
6. "test_cases" must be an array.
7. Every test case must contain:
   - title
   - method
   - endpoint
   - test_type
   - description
   - request_data
   - expected_result

8. request_data MUST be a STRING containing valid JSON.

9. Example of valid request_data:

"{{\\"name\\":\\"Jayasree\\",\\"email\\":\\"jayasree@example.com\\",\\"age\\":22}}"

10. NEVER generate invalid JSON such as:

"{{\\"name\\":\\"Jayasree@\\"\\",\\"email\\":\\"test@example.com\\"}}"

11. Never put an unescaped double quote inside a JSON string.

12. Do not use expressions such as:
   "* 100"
   "minimum + 1"
   "maximum - 1"

13. Use actual values instead.

14. Use the OpenAPI information when available.

15. Do not invent API fields that are not supported by the OpenAPI specification.

16. For GET requests without a request body, use:
"{{}}"

17. For path parameters, use realistic values.

18. Keep descriptions short and clear.

Return exactly this structure:

{{
    "test_cases": [
        {{
            "title": "Valid request",
            "method": "{method}",
            "endpoint": "{endpoint}",
            "test_type": "Positive",
            "description": "Verify that a valid request is accepted.",
            "request_data": "{{\\"name\\":\\"Jayasree\\",\\"email\\":\\"jayasree@example.com\\",\\"age\\":22}}",
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
            timeout=300
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
    # VALIDATE TOP LEVEL OBJECT
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

        # Ignore invalid entries
        if not isinstance(
            test_case,
            dict
        ):
            continue

        # Make sure required fields exist
        for field in [
            "title",
            "method",
            "endpoint",
            "test_type",
            "description",
            "request_data",
            "expected_result"
        ]:

            if field not in test_case:

                test_case[field] = ""

        # ----------------------------------------------------
        # Normalize values
        # ----------------------------------------------------

        test_case["title"] = str(
            test_case["title"]
        )

        test_case["method"] = str(
            test_case["method"]
        ).upper()

        test_case["endpoint"] = str(
            test_case["endpoint"]
        )

        test_case["test_type"] = str(
            test_case["test_type"]
        )

        test_case["description"] = str(
            test_case["description"]
        )

        test_case["expected_result"] = str(
            test_case["expected_result"]
        )

        # ----------------------------------------------------
        # Normalize request_data
        # ----------------------------------------------------

        test_case["request_data"] = normalize_request_data(
            test_case["request_data"]
        )

        # ----------------------------------------------------
        # Validate final test case
        # ----------------------------------------------------

        if validate_test_case(
            test_case
        ):

            valid_test_cases.append(
                test_case
            )

    # ========================================================
    # FINAL CHECK
    # ========================================================

    if not valid_test_cases:

        raise RuntimeError(
            "AI did not generate any valid test cases."
        )

    # ========================================================
    # RETURN
    # ========================================================

    return valid_test_cases