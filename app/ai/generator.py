import json
import re
import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"

BASE_URL = "http://127.0.0.1:8000"


# ============================================================
# 1. READ API INFORMATION
# ============================================================

def analyze_api_structure(api):
    """
    Read API information stored in the database.

    The OpenAPI details are used to tell the AI exactly what
    endpoint, method, parameters and request body are available.
    """

    details = {}

    if getattr(api, "openapi_details", None):
        try:
            if isinstance(api.openapi_details, str):
                details = json.loads(api.openapi_details)
            elif isinstance(api.openapi_details, dict):
                details = api.openapi_details
        except Exception:
            details = {}

    return {
        "method": (api.method or "GET").upper(),
        "endpoint": api.endpoint or "/",
        "request_body": api.request_body or "",
        "openapi_details": details,
    }


# ============================================================
# 2. CALL OLLAMA
# ============================================================

def call_ollama(prompt):
    """
    Send the prompt to the local Ollama server.
    """

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
    }

    response = requests.post(
        OLLAMA_URL,
        json=payload,
        timeout=120,
    )

    response.raise_for_status()

    data = response.json()

    return data.get("response", "")


# ============================================================
# 3. EXTRACT JSON FROM AI RESPONSE
# ============================================================

def extract_json(text):
    """
    Safely extract JSON from the Ollama response.
    """

    if not text:
        return {}

    text = text.strip()

    # Direct JSON
    try:
        return json.loads(text)
    except Exception:
        pass

    # JSON inside markdown code block
    match = re.search(
        r"```(?:json)?\s*(.*?)\s*```",
        text,
        re.DOTALL | re.IGNORECASE,
    )

    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass

    # Find first { and last }
    start = text.find("{")
    end = text.rfind("}")

    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except Exception:
            pass

    # Find first [ and last ]
    start = text.find("[")
    end = text.rfind("]")

    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except Exception:
            pass

    return {}


# ============================================================
# 4. CONVERT VALUE TO INTEGER
# ============================================================

def safe_int(value, default=None):
    try:
        return int(value)
    except Exception:
        return default


# ============================================================
# 5. FIND PATH PARAMETERS
# ============================================================

def find_path_parameters(endpoint):
    """
    Example:

        /users/{id}

    returns:

        ["id"]
    """

    if not endpoint:
        return []

    return re.findall(r"\{([^{}]+)\}", endpoint)


# ============================================================
# 6. CREATE CONCRETE ENDPOINT
# ============================================================

def build_concrete_endpoint(endpoint, request_data=None):
    """
    Replace OpenAPI path parameters with real values.

    Example:

        /users/{id}

    becomes:

        /users/1

    This prevents requests such as:

        /users/{id}

    which previously became:

        /users/%7Bid%7D
    """

    if not endpoint:
        return "/"

    endpoint = str(endpoint)

    parameters = find_path_parameters(endpoint)

    if not parameters:
        return endpoint

    values = {}

    if isinstance(request_data, dict):
        path_values = request_data.get("path_parameters")

        if isinstance(path_values, dict):
            values.update(path_values)

    elif request_data is not None:
        # If request_data is a simple value, use it for the
        # first path parameter.
        values[parameters[0]] = request_data

    for parameter in parameters:
        value = values.get(parameter)

        if value is None or value == "":
            value = "1"

        endpoint = endpoint.replace(
            "{" + parameter + "}",
            str(value),
        )

    return endpoint


# ============================================================
# 7. CLEAN REQUEST DATA
# ============================================================

def clean_request_data(request_data):
    """
    Convert request data into something that can safely be
    stored as JSON text.
    """

    if request_data is None:
        return {}

    if isinstance(request_data, (dict, list, int, float, bool)):
        return request_data

    if isinstance(request_data, str):
        value = request_data.strip()

        if not value:
            return {}

        try:
            return json.loads(value)
        except Exception:
            return value

    return str(request_data)


# ============================================================
# 8. GET EXPECTED STATUS CODE
# ============================================================

def get_expected_status_code(test_case, default=200):
    """
    Get the expected HTTP status code.

    AI is allowed to suggest it, but we validate it later
    against the actual API behaviour.
    """

    status = test_case.get("expected_status_code")

    status = safe_int(status)

    if status is None:
        return default

    # Only realistic HTTP status codes
    if status < 100 or status > 599:
        return default

    return status


# ============================================================
# 9. GENERATE DISPLAY TEST CODE
# ============================================================

def generate_test_code(
    method,
    endpoint,
    request_data=None,
    expected_status_code=200,
):
    """
    Create deterministic executable Python code.

    IMPORTANT:
    The AI does NOT generate this code anymore.

    Python generates it so the displayed code always matches
    the request that was actually executed.
    """

    method = method.upper()
    endpoint = endpoint or "/"

    url = f"{BASE_URL}{endpoint}"

    lines = [
        "import requests",
        "",
        f'BASE_URL = "{BASE_URL}"',
        "",
        "def test_api():",
        f'    url = "{url}"',
    ]

    data = clean_request_data(request_data)

    # Path parameter / simple request data
    if isinstance(data, dict):

        path_parameters = data.get("path_parameters")

        if isinstance(path_parameters, dict):
            lines.append(
                f"    path_parameters = {repr(path_parameters)}"
            )

        query_parameters = data.get("query_parameters")

        if isinstance(query_parameters, dict) and query_parameters:
            lines.append(
                f"    params = {repr(query_parameters)}"
            )
        else:
            lines.append("    params = None")

        body = data.get("body")

        if body is not None:
            lines.append(
                f"    json_data = {repr(body)}"
            )
        else:
            # If the dict itself is a request body
            if method in {"POST", "PUT", "PATCH"}:
                normal_body = {
                    k: v
                    for k, v in data.items()
                    if k not in {
                        "path_parameters",
                        "query_parameters",
                        "body",
                    }
                }

                if normal_body:
                    lines.append(
                        f"    json_data = {repr(normal_body)}"
                    )
                else:
                    lines.append("    json_data = None")
            else:
                lines.append("    json_data = None")

    else:
        lines.append("    params = None")
        lines.append("    json_data = None")

    if method == "GET":
        lines.append(
            "    response = requests.get(url, params=params)"
        )

    elif method == "POST":
        lines.append(
            "    response = requests.post("
            "url, params=params, json=json_data"
            ")"
        )

    elif method == "PUT":
        lines.append(
            "    response = requests.put("
            "url, params=params, json=json_data"
            ")"
        )

    elif method == "PATCH":
        lines.append(
            "    response = requests.patch("
            "url, params=params, json=json_data"
            ")"
        )

    elif method == "DELETE":
        lines.append(
            "    response = requests.delete("
            "url, params=params"
            ")"
        )

    else:
        lines.append(
            "    response = requests.request("
            f'"{method}", url, params=params, json=json_data'
            ")"
        )

    lines.extend(
        [
            "",
            "    print('Status:', response.status_code)",
            "    print('Response:', response.text)",
            "",
            f"    assert response.status_code == {expected_status_code}",
        ]
    )

    return "\n".join(lines)


# ============================================================
# 10. EXECUTE TEST
# ============================================================

def execute_test_case(
    method,
    endpoint,
    request_data=None,
    expected_status_code=200,
):
    """
    Execute the API request directly using requests.

    We do NOT execute arbitrary AI-generated Python with exec().
    This is safer and makes execution predictable.
    """

    method = method.upper()
    endpoint = endpoint or "/"

    concrete_endpoint = build_concrete_endpoint(
        endpoint,
        request_data,
    )

    url = f"{BASE_URL}{concrete_endpoint}"

    data = clean_request_data(request_data)

    params = None
    body = None

    if isinstance(data, dict):

        query_parameters = data.get("query_parameters")

        if isinstance(query_parameters, dict):
            params = query_parameters

        if "body" in data:
            body = data.get("body")
        elif method in {"POST", "PUT", "PATCH"}:

            body = {
                key: value
                for key, value in data.items()
                if key not in {
                    "path_parameters",
                    "query_parameters",
                }
            }

            if not body:
                body = None

    try:

        if method == "GET":
            response = requests.get(
                url,
                params=params,
                timeout=15,
            )

        elif method == "POST":
            response = requests.post(
                url,
                params=params,
                json=body,
                timeout=15,
            )

        elif method == "PUT":
            response = requests.put(
                url,
                params=params,
                json=body,
                timeout=15,
            )

        elif method == "PATCH":
            response = requests.patch(
                url,
                params=params,
                json=body,
                timeout=15,
            )

        elif method == "DELETE":
            response = requests.delete(
                url,
                params=params,
                timeout=15,
            )

        else:
            response = requests.request(
                method,
                url,
                params=params,
                json=body,
                timeout=15,
            )

        try:
            response_body = response.json()
        except Exception:
            response_body = response.text

        actual_result = {
            "url": url,
            "status_code": response.status_code,
            "response": response_body,
        }

        execution_status = (
            "PASS"
            if response.status_code == expected_status_code
            else "FAIL"
        )

        return {
            "actual_result": json.dumps(
                actual_result,
                ensure_ascii=False,
            ),
            "execution_status": execution_status,
            "actual_status_code": response.status_code,
        }

    except requests.RequestException as exc:

        actual_result = {
            "url": url,
            "error": str(exc),
        }

        return {
            "actual_result": json.dumps(
                actual_result,
                ensure_ascii=False,
            ),
            "execution_status": "FAIL",
            "actual_status_code": None,
        }


# ============================================================
# 11. BUILD FALLBACK TEST CASES
# ============================================================

def create_fallback_test_cases(api_info):
    """
    If Ollama is unavailable or returns invalid JSON,
    create basic reliable test cases.

    These cases always use the actual API method and endpoint.
    """

    method = api_info["method"]
    endpoint = api_info["endpoint"]

    path_parameters = find_path_parameters(endpoint)

    cases = []

    # --------------------------------------------------------
    # GET
    # --------------------------------------------------------

    if method == "GET":

        if path_parameters:

            cases.append(
                {
                    "title": "Valid Path Parameter",
                    "method": method,
                    "endpoint": build_concrete_endpoint(
                        endpoint,
                        {"path_parameters": {
                            path_parameters[0]: "1"
                        }},
                    ),
                    "test_type": "Positive",
                    "description": "Verify the endpoint with a valid path parameter.",
                    "request_data": {
                        "path_parameters": {
                            path_parameters[0]: "1"
                        }
                    },
                    "expected_status_code": 200,
                    "expected_result": "Successful response.",
                }
            )

            cases.append(
                {
                    "title": "Invalid Path Parameter",
                    "method": method,
                    "endpoint": build_concrete_endpoint(
                        endpoint,
                        {"path_parameters": {
                            path_parameters[0]: "abc"
                        }},
                    ),
                    "test_type": "Negative",
                    "description": "Verify the endpoint rejects an invalid path parameter.",
                    "request_data": {
                        "path_parameters": {
                            path_parameters[0]: "abc"
                        }
                    },
                    "expected_status_code": 422,
                    "expected_result": "Validation error.",
                }
            )

        else:

            cases.append(
                {
                    "title": "Valid GET Request",
                    "method": method,
                    "endpoint": endpoint,
                    "test_type": "Positive",
                    "description": "Verify that the GET endpoint returns successfully.",
                    "request_data": {},
                    "expected_status_code": 200,
                    "expected_result": "Successful response.",
                }
            )

    # --------------------------------------------------------
    # POST
    # --------------------------------------------------------

    elif method == "POST":

        body = {}

        try:
            parsed = json.loads(api_info["request_body"])
            if isinstance(parsed, dict):
                body = parsed
        except Exception:
            body = {}

        cases.append(
            {
                "title": "Valid POST Request",
                "method": method,
                "endpoint": endpoint,
                "test_type": "Positive",
                "description": "Verify that the POST endpoint accepts a valid request.",
                "request_data": {
                    "body": body
                },
                "expected_status_code": 200,
                "expected_result": "Successful response.",
            }
        )

    # --------------------------------------------------------
    # Other methods
    # --------------------------------------------------------

    else:

        cases.append(
            {
                "title": f"Valid {method} Request",
                "method": method,
                "endpoint": endpoint,
                "test_type": "Positive",
                "description": f"Verify that the {method} endpoint responds successfully.",
                "request_data": {},
                "expected_status_code": 200,
                "expected_result": "Successful response.",
            }
        )

    return cases


# ============================================================
# 12. NORMALIZE AI TEST CASES
# ============================================================

def normalize_test_cases(raw_cases, api_info):
    """
    Clean AI output and make sure every test belongs to the
    actual API being tested.

    The AI cannot invent another HTTP method or endpoint.
    """

    if isinstance(raw_cases, dict):

        if "test_cases" in raw_cases:
            raw_cases = raw_cases["test_cases"]

        elif "tests" in raw_cases:
            raw_cases = raw_cases["tests"]

        else:
            raw_cases = [raw_cases]

    if not isinstance(raw_cases, list):
        return []

    actual_method = api_info["method"]
    actual_endpoint = api_info["endpoint"]

    normalized = []

    for item in raw_cases:

        if not isinstance(item, dict):
            continue

        method = str(
            item.get("method", actual_method)
        ).upper()

        endpoint = str(
            item.get("endpoint", actual_endpoint)
        )

        # ----------------------------------------------------
        # IMPORTANT:
        # AI must not invent another endpoint or method.
        # ----------------------------------------------------

        if method != actual_method:
            method = actual_method

        # If the AI invents another endpoint, use the actual one.
        base_path = re.sub(
            r"\{[^{}]+\}",
            "{}",
            actual_endpoint,
        )

        generated_path = re.sub(
            r"\{[^{}]+\}",
            "{}",
            endpoint,
        )

        if generated_path != base_path:
            endpoint = actual_endpoint

        title = str(
            item.get(
                "title",
                f"{actual_method} {actual_endpoint} Test",
            )
        )

        test_type = str(
            item.get("test_type", "Functional")
        )

        description = str(
            item.get(
                "description",
                "Verify API behaviour.",
            )
        )

        request_data = clean_request_data(
            item.get("request_data", {})
        )

        expected_status_code = get_expected_status_code(
            item,
            200,
        )

        expected_result = str(
            item.get(
                "expected_result",
                "Expected HTTP response.",
            )
        )

        normalized.append(
            {
                "title": title,
                "method": method,
                "endpoint": endpoint,
                "test_type": test_type,
                "description": description,
                "request_data": request_data,
                "expected_status_code": expected_status_code,
                "expected_result": expected_result,
            }
        )

    return normalized


# ============================================================
# 13. AI GENERATION
# ============================================================

def generate_ai_test_cases(api):
    """
    Generate test scenarios using Ollama, then execute every
    generated test against the backend.

    Returns a list containing:

        title
        method
        endpoint
        test_type
        description
        request_data
        expected_status_code
        expected_result
        test_code
        actual_result
        execution_status
    """

    api_info = analyze_api_structure(api)

    method = api_info["method"]
    endpoint = api_info["endpoint"]

    openapi_details = api_info["openapi_details"]

    prompt = f"""
You are an API testing expert.

Generate functional API test scenarios for ONLY this API.

HTTP METHOD:
{method}

ENDPOINT:
{endpoint}

REQUEST BODY:
{api_info["request_body"]}

OPENAPI DETAILS:
{json.dumps(openapi_details, indent=2)}

STRICT RULES:

1. Generate tests ONLY for the supplied HTTP method:
   {method}

2. Generate tests ONLY for the supplied endpoint:
   {endpoint}

3. NEVER invent PUT, PATCH, DELETE, update, retrieval,
   login or other operations if they are not the supplied API.

4. If the endpoint contains a path parameter such as:
   /users/{{id}}

   use concrete values such as:
   /users/1
   /users/999999
   /users/abc

5. Never use:
   /users/{{id}}
   as an executable endpoint.

6. Only use query parameters that actually exist in the
   OpenAPI details.

7. Only use request-body fields that are actually described
   in the request schema.

8. expected_status_code MUST be a valid HTTP status code
   between 100 and 599.

9. Do NOT confuse input values with HTTP status codes.

10. Generate positive, negative and boundary tests only when
    they make sense for this API.

Return ONLY valid JSON in this format:

{{
  "test_cases": [
    {{
      "title": "Test title",
      "method": "{method}",
      "endpoint": "{endpoint}",
      "test_type": "Positive",
      "description": "What this test verifies",
      "request_data": {{}},
      "expected_status_code": 200,
      "expected_result": "Expected HTTP behaviour"
    }}
  ]
}}
"""

    try:

        ai_response = call_ollama(prompt)

        parsed = extract_json(ai_response)

        test_cases = normalize_test_cases(
            parsed,
            api_info,
        )

    except Exception as exc:

        print(
            "Ollama generation failed:",
            str(exc),
        )

        test_cases = []

    # --------------------------------------------------------
    # Fallback
    # --------------------------------------------------------

    if not test_cases:
        test_cases = create_fallback_test_cases(
            api_info
        )

    # --------------------------------------------------------
    # Execute every test
    # --------------------------------------------------------

    final_cases = []

    for test_case in test_cases:

        request_data = test_case["request_data"]

        expected_status_code = test_case[
            "expected_status_code"
        ]

        # Make executable endpoint
        executable_endpoint = build_concrete_endpoint(
            test_case["endpoint"],
            request_data,
        )

        test_case["endpoint"] = executable_endpoint

        # Generate deterministic executable code
        test_case["test_code"] = generate_test_code(
            method=test_case["method"],
            endpoint=executable_endpoint,
            request_data=request_data,
            expected_status_code=expected_status_code,
        )

        # Execute request
        execution = execute_test_case(
            method=test_case["method"],
            endpoint=executable_endpoint,
            request_data=request_data,
            expected_status_code=expected_status_code,
        )

        test_case["actual_result"] = execution[
            "actual_result"
        ]

        test_case["execution_status"] = execution[
            "execution_status"
        ]

        final_cases.append(test_case)

    return final_cases