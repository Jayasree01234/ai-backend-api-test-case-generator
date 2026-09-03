import json
import requests


OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"


# ============================================================
# HELPER: ANALYZE API STRUCTURE
# ============================================================

def analyze_api_structure(
    method: str,
    endpoint: str,
    request_body: str,
    openapi_details: dict
):
    parameters = openapi_details.get(
        "parameters",
        []
    )

    if not isinstance(parameters, list):
        parameters = []

    path_parameters = []
    query_parameters = []
    header_parameters = []

    for parameter in parameters:

        if not isinstance(parameter, dict):
            continue

        parameter_location = parameter.get(
            "in",
            ""
        )

        if parameter_location == "path":
            path_parameters.append(parameter)

        elif parameter_location == "query":
            query_parameters.append(parameter)

        elif parameter_location == "header":
            header_parameters.append(parameter)

    request_body_details = openapi_details.get(
        "requestBody",
        {}
    )

    has_request_body = bool(
        request_body_details
    ) or bool(request_body)

    return {
        "method": method.upper(),
        "endpoint": endpoint,
        "path_parameters": path_parameters,
        "query_parameters": query_parameters,
        "header_parameters": header_parameters,
        "has_request_body": has_request_body,
        "request_body_details": request_body_details
    }


# ============================================================
# CREATE AI PROMPT
# ============================================================

def create_prompt(api_info: dict):
    method = api_info["method"]
    endpoint = api_info["endpoint"]

    path_parameters = api_info["path_parameters"]
    query_parameters = api_info["query_parameters"]
    header_parameters = api_info["header_parameters"]

    has_request_body = api_info["has_request_body"]
    request_body_details = api_info[
        "request_body_details"
    ]

    prompt = f"""
You are an expert API QA engineer.

Generate intelligent and relevant test cases ONLY for the API described below.

API INFORMATION:

HTTP Method: {method}
Endpoint: {endpoint}

PATH PARAMETERS:
{json.dumps(path_parameters, indent=2)}

QUERY PARAMETERS:
{json.dumps(query_parameters, indent=2)}

HEADER PARAMETERS:
{json.dumps(header_parameters, indent=2)}

HAS REQUEST BODY:
{has_request_body}

REQUEST BODY DETAILS:
{json.dumps(request_body_details, indent=2)}

IMPORTANT RULES:

1. Generate test cases ONLY relevant to this specific API.
2. Do NOT invent parameters that do not exist.
3. If there are NO path parameters, do NOT generate path parameter tests.
4. If there are NO query parameters, do NOT generate query parameter tests.
5. If there is NO request body, do NOT generate JSON body validation tests.
6. For POST, PUT, or PATCH APIs with a request body, generate validation tests for required fields and invalid values.
7. For GET APIs, focus on endpoint behavior and existing parameters.
8. For endpoints containing path parameters such as {{id}}, generate valid, invalid, missing, and boundary tests where relevant.
9. Generate positive, negative, boundary, validation, and security tests only when applicable.
10. Do not generate duplicate test cases.
11. Every test case must be meaningful and realistic.

Return ONLY valid JSON.

Use exactly this format:

{{
  "test_cases": [
    {{
      "title": "Short test case title",
      "method": "{method}",
      "endpoint": "{endpoint}",
      "test_type": "Positive",
      "description": "What is being tested",
      "request_data": "Example request data or parameter value",
      "expected_result": "Expected API response"
    }}
  ]
}}

Generate between 5 and 10 relevant test cases.
"""

    return prompt


# ============================================================
# VALIDATE TEST CASE
# ============================================================

def validate_test_case(
    test_case: dict,
    method: str,
    endpoint: str
):
    if not isinstance(test_case, dict):
        return None

    title = str(
        test_case.get("title", "")
    ).strip()

    description = str(
        test_case.get("description", "")
    ).strip()

    expected_result = str(
        test_case.get("expected_result", "")
    ).strip()

    test_type = str(
        test_case.get("test_type", "")
    ).strip()

    request_data = test_case.get(
        "request_data",
        ""
    )

    if isinstance(
        request_data,
        (dict, list)
    ):
        request_data = json.dumps(
            request_data
        )

    else:
        request_data = str(
            request_data
        )

    if not title:
        return None

    if not description:
        return None

    if not expected_result:
        return None

    if not test_type:
        test_type = "Functional"

    allowed_types = {
        "Positive",
        "Negative",
        "Boundary",
        "Validation",
        "Security",
        "Functional"
    }

    if test_type not in allowed_types:
        test_type = "Functional"

    return {
        "title": title,
        "method": method.upper(),
        "endpoint": endpoint,
        "test_type": test_type,
        "description": description,
        "request_data": request_data,
        "expected_result": expected_result
    }


# ============================================================
# REMOVE DUPLICATE TEST CASES
# ============================================================

def remove_duplicates(test_cases: list):
    unique_test_cases = []
    seen = set()

    for test_case in test_cases:

        key = (
            test_case.get("title", "").lower(),
            test_case.get("method", "").upper(),
            test_case.get("endpoint", ""),
            test_case.get("test_type", "").lower()
        )

        if key in seen:
            continue

        seen.add(key)

        unique_test_cases.append(
            test_case
        )

    return unique_test_cases


# ============================================================
# GENERATE AI TEST CASES
# ============================================================

def generate_ai_test_cases(
    method: str,
    endpoint: str,
    request_body: str = "",
    openapi_details: dict = None
):
    if openapi_details is None:
        openapi_details = {}

    if not isinstance(openapi_details, dict):
        openapi_details = {}

    # --------------------------------------------------------
    # ANALYZE API STRUCTURE
    # --------------------------------------------------------

    api_info = analyze_api_structure(
        method=method,
        endpoint=endpoint,
        request_body=request_body,
        openapi_details=openapi_details
    )

    # --------------------------------------------------------
    # CREATE PROMPT
    # --------------------------------------------------------

    prompt = create_prompt(
        api_info
    )

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.2
        }
    }

    # --------------------------------------------------------
    # CALL OLLAMA
    # --------------------------------------------------------

    try:

        response = requests.post(
            OLLAMA_URL,
            json=payload,
            timeout=120
        )

        response.raise_for_status()

    except requests.exceptions.ConnectionError as exc:

        raise RuntimeError(
            "Cannot connect to Ollama. "
            "Make sure Ollama is running."
        ) from exc

    except requests.exceptions.Timeout as exc:

        raise RuntimeError(
            "AI generation timed out."
        ) from exc

    except requests.exceptions.RequestException as exc:

        raise RuntimeError(
            f"Ollama request failed: {str(exc)}"
        ) from exc

    # --------------------------------------------------------
    # READ RESPONSE
    # --------------------------------------------------------

    try:

        ollama_response = response.json()

        ai_response = ollama_response.get(
            "response",
            ""
        )

        if not ai_response:
            raise ValueError(
                "Empty AI response"
            )

    except (
        ValueError,
        json.JSONDecodeError
    ) as exc:

        raise RuntimeError(
            "Invalid response received from Ollama."
        ) from exc

    # --------------------------------------------------------
    # PARSE AI JSON
    # --------------------------------------------------------

    try:

        parsed_response = json.loads(
            ai_response
        )

    except json.JSONDecodeError as exc:

        raise RuntimeError(
            f"AI returned invalid JSON: {str(exc)}"
        ) from exc

    # --------------------------------------------------------
    # GET TEST CASE LIST
    # --------------------------------------------------------

    if isinstance(parsed_response, dict):

        ai_test_cases = parsed_response.get(
            "test_cases",
            []
        )

    elif isinstance(parsed_response, list):

        ai_test_cases = parsed_response

    else:

        ai_test_cases = []

    if not isinstance(ai_test_cases, list):
        ai_test_cases = []

    # --------------------------------------------------------
    # VALIDATE GENERATED TEST CASES
    # --------------------------------------------------------

    valid_test_cases = []

    for test_case in ai_test_cases:

        validated_case = validate_test_case(
            test_case=test_case,
            method=method,
            endpoint=endpoint
        )

        if validated_case:
            valid_test_cases.append(
                validated_case
            )

    # --------------------------------------------------------
    # REMOVE DUPLICATES
    # --------------------------------------------------------

    valid_test_cases = remove_duplicates(
        valid_test_cases
    )

    # --------------------------------------------------------
    # ENSURE AI GENERATED RESULTS
    # --------------------------------------------------------

    if not valid_test_cases:

        raise RuntimeError(
            "AI did not generate valid test cases "
            "for this API."
        )

    return valid_test_cases