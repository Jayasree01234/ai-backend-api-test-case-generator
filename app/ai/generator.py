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
    details = {}

    if getattr(api, "openapi_details", None):
        try:
            if isinstance(api.openapi_details, str):
                details = json.loads(api.openapi_details)
            elif isinstance(api.openapi_details, dict):
                details = api.openapi_details
        except Exception:
            details = {}

    parameters = details.get("parameters", [])

    if not isinstance(parameters, list):
        parameters = []

    path_parameters = []
    query_parameters = []
    header_parameters = []

    for parameter in parameters:
        if not isinstance(parameter, dict):
            continue

        name = parameter.get("name")
        location = parameter.get("in")

        if not name:
            continue

        if location == "path":
            path_parameters.append(parameter)
        elif location == "query":
            query_parameters.append(parameter)
        elif location == "header":
            header_parameters.append(parameter)

    responses = details.get("responses", {})

    if not isinstance(responses, dict):
        responses = {}

    return {
        "method": (api.method or "GET").upper(),
        "endpoint": api.endpoint or "/",
        "request_body": api.request_body or "",
        "openapi_details": details,
        "parameters": parameters,
        "path_parameters": path_parameters,
        "query_parameters": query_parameters,
        "header_parameters": header_parameters,
        "responses": responses,
    }


# ============================================================
# 2. CALL OLLAMA
# ============================================================

def call_ollama(prompt):
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
# 3. EXTRACT JSON
# ============================================================

def extract_json(text):
    if not text:
        return {}

    text = text.strip()

    try:
        return json.loads(text)
    except Exception:
        pass

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

    start = text.find("{")
    end = text.rfind("}")

    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except Exception:
            pass

    start = text.find("[")
    end = text.rfind("]")

    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except Exception:
            pass

    return {}


# ============================================================
# 4. SAFE INTEGER
# ============================================================

def safe_int(value, default=None):
    try:
        return int(value)
    except Exception:
        return default


# ============================================================
# 5. PATH PARAMETERS
# ============================================================

def find_path_parameters(endpoint):
    if not endpoint:
        return []

    return re.findall(
        r"\{([^{}]+)\}",
        str(endpoint),
    )


def endpoint_shape(endpoint):
    """
    Converts:
        /users/123
    and
        /users/{id}

    into comparable path shapes.

    Example:
        /users/{id} -> /users/{}
        /users/123  -> /users/{}
    """

    if not endpoint:
        return "/"

    endpoint = str(endpoint).strip()

    endpoint = re.sub(
        r"\{[^{}]+\}",
        "{}",
        endpoint,
    )

    endpoint = re.sub(
        r"/\d+(?=/|$)",
        "/{}",
        endpoint,
    )

    return endpoint


def endpoint_matches_api(endpoint, actual_endpoint):
    """
    Make sure AI does not generate a completely different endpoint.
    """

    return endpoint_shape(endpoint) == endpoint_shape(
        actual_endpoint
    )


# ============================================================
# 6. BUILD CONCRETE ENDPOINT
# ============================================================

def build_concrete_endpoint(endpoint, request_data=None):
    if not endpoint:
        return "/"

    endpoint = str(endpoint)

    parameters = find_path_parameters(endpoint)

    if not parameters:
        return endpoint

    values = {}

    if isinstance(request_data, dict):

        path_values = request_data.get(
            "path_parameters"
        )

        if isinstance(path_values, dict):
            values.update(path_values)

    elif request_data is not None:

        values[parameters[0]] = request_data

    for parameter in parameters:

        value = values.get(parameter)

        # Missing parameter gets a safe default.
        if value is None:
            value = "1"

        # Do NOT silently change an explicitly invalid
        # empty value into 1.
        if value == "":
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

    if request_data is None:
        return {}

    if isinstance(
        request_data,
        (dict, list, int, float, bool),
    ):
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
# 8. OPENAPI STATUS CODES
# ============================================================

def get_openapi_status_codes(api_info):

    responses = api_info.get(
        "responses",
        {},
    )

    if not isinstance(responses, dict):
        return []

    status_codes = []

    for key in responses.keys():

        code = safe_int(key)

        if code is not None and 100 <= code <= 599:
            status_codes.append(code)

    return sorted(set(status_codes))


def get_success_status_code(
    api_info,
    default=200,
):

    status_codes = get_openapi_status_codes(
        api_info
    )

    success_codes = [
        code
        for code in status_codes
        if 200 <= code <= 299
    ]

    if success_codes:
        return success_codes[0]

    return default


def get_validation_status_code(
    api_info,
    default=422,
):

    status_codes = get_openapi_status_codes(
        api_info
    )

    if 422 in status_codes:
        return 422

    if 400 in status_codes:
        return 400

    return default


# ============================================================
# 9. EXPECTED STATUS
# ============================================================

def get_expected_status_code(
    test_case,
    api_info=None,
    default=200,
):

    status = safe_int(
        test_case.get(
            "expected_status_code"
        )
    )

    if status is None:

        if api_info:

            test_type = str(
                test_case.get(
                    "test_type",
                    "",
                )
            ).lower()

            if any(
                word in test_type
                for word in [
                    "negative",
                    "validation",
                    "invalid",
                ]
            ):
                return get_validation_status_code(
                    api_info,
                    422,
                )

            return get_success_status_code(
                api_info,
                default,
            )

        return default

    if status < 100 or status > 599:

        if api_info:
            return get_success_status_code(
                api_info,
                default,
            )

        return default

    return status


# ============================================================
# 10. PARAMETER HELPERS
# ============================================================

def get_parameter_schema(parameter):
    if not isinstance(parameter, dict):
        return {}

    schema = parameter.get("schema")

    if isinstance(schema, dict):
        return schema

    return {}


def get_parameter_type(parameter):
    schema = get_parameter_schema(parameter)

    return schema.get(
        "type",
        parameter.get("type", "string"),
    )


def get_query_parameter_names(api_info):

    names = []

    for parameter in api_info.get(
        "query_parameters",
        [],
    ):

        if not isinstance(parameter, dict):
            continue

        name = parameter.get("name")

        if name:
            names.append(name)

    return names


def get_path_parameter_names(api_info):

    names = []

    for parameter in api_info.get(
        "path_parameters",
        [],
    ):

        if not isinstance(parameter, dict):
            continue

        name = parameter.get("name")

        if name:
            names.append(name)

    for name in find_path_parameters(
        api_info["endpoint"]
    ):

        if name not in names:
            names.append(name)

    return names


# ============================================================
# 11. NORMALIZE QUERY PARAMETERS
# ============================================================

def normalize_query_parameters(
    request_data,
    api_info,
):

    if not isinstance(request_data, dict):
        return {}

    known_names = get_query_parameter_names(
        api_info
    )

    query_data = request_data.get(
        "query_parameters"
    )

    if not isinstance(query_data, dict):
        query_data = {}

    cleaned = {}

    # First use explicitly supplied query parameters.
    for key, value in query_data.items():

        if key in known_names:
            cleaned[key] = value

    # Fix AI mistake where it puts query parameter
    # at the top level.
    for key, value in request_data.items():

        if key in known_names:
            cleaned[key] = value

    return cleaned


# ============================================================
# 12. NORMALIZE PATH PARAMETERS
# ============================================================

def normalize_path_parameters(
    request_data,
    api_info,
):

    if not isinstance(request_data, dict):
        request_data = {}

    actual_names = get_path_parameter_names(
        api_info
    )

    if not actual_names:
        return {}

    path_data = request_data.get(
        "path_parameters"
    )

    if not isinstance(path_data, dict):
        path_data = {}

    cleaned = {}

    # Exact parameter names.
    for name in actual_names:

        if name in path_data:
            cleaned[name] = path_data[name]

    # If there is only one actual path parameter,
    # map common AI names like "id" to the actual name.
    if len(actual_names) == 1:

        actual_name = actual_names[0]

        if actual_name not in cleaned:

            for possible_name in [
                "id",
                "user_id",
                "item_id",
                "product_id",
                "resource_id",
            ]:

                if possible_name in path_data:

                    cleaned[actual_name] = (
                        path_data[possible_name]
                    )

                    break

    # Also check top-level fields.
    if len(actual_names) == 1:

        actual_name = actual_names[0]

        if actual_name not in cleaned:

            if actual_name in request_data:

                cleaned[actual_name] = request_data[
                    actual_name
                ]

    return cleaned


# ============================================================
# 13. BODY HELPERS
# ============================================================

def parse_request_body(request_body):

    if not request_body:
        return {}

    try:

        parsed = json.loads(
            request_body
        )

        if isinstance(parsed, dict):
            return parsed

    except Exception:
        pass

    return {}


def get_body_schema(api_info):

    details = api_info.get(
        "openapi_details",
        {},
    )

    if not isinstance(details, dict):
        return {}

    request_body = details.get(
        "requestBody"
    )

    if isinstance(request_body, dict):

        content = request_body.get(
            "content",
            {}
        )

        if isinstance(content, dict):

            json_content = content.get(
                "application/json"
            )

            if isinstance(
                json_content,
                dict,
            ):

                schema = json_content.get(
                    "schema",
                    {}
                )

                if isinstance(
                    schema,
                    dict,
                ):
                    return schema

    return {}


def get_body_properties(api_info):

    schema = get_body_schema(
        api_info
    )

    properties = schema.get(
        "properties",
        {}
    )

    if isinstance(properties, dict):
        return properties

    # Fallback to stored request body example.
    sample = parse_request_body(
        api_info.get(
            "request_body",
            ""
        )
    )

    if isinstance(sample, dict):
        return {
            key: {}
            for key in sample.keys()
        }

    return {}


def get_required_body_fields(api_info):

    schema = get_body_schema(
        api_info
    )

    required = schema.get(
        "required",
        []
    )

    if isinstance(required, list):
        return required

    return []


def extract_body(
    request_data,
    api_info,
):

    if not isinstance(request_data, dict):
        return None

    if "body" in request_data:
        return request_data.get(
            "body"
        )

    if api_info["method"] not in {
        "POST",
        "PUT",
        "PATCH",
    }:
        return None

    allowed_fields = get_body_properties(
        api_info
    )

    body = {}

    for key, value in request_data.items():

        if key in {
            "path_parameters",
            "query_parameters",
        }:
            continue

        if not allowed_fields or key in allowed_fields:
            body[key] = value

    return body if body else None


# ============================================================
# 14. GENERATE EXECUTABLE CODE
# ============================================================

def generate_test_code(
    method,
    endpoint,
    request_data=None,
    expected_status_code=200,
):

    method = method.upper()

    endpoint = endpoint or "/"

    url = f"{BASE_URL}{endpoint}"

    data = clean_request_data(
        request_data
    )

    lines = [
        "import requests",
        "",
        f'BASE_URL = "{BASE_URL}"',
        "",
        "def test_api():",
        f'    url = "{url}"',
    ]

    params = None
    body = None

    if isinstance(data, dict):

        query_parameters = data.get(
            "query_parameters"
        )

        if (
            isinstance(
                query_parameters,
                dict,
            )
            and query_parameters
        ):
            params = query_parameters

        body = data.get(
            "body"
        )

        if (
            body is None
            and method in {
                "POST",
                "PUT",
                "PATCH",
            }
        ):
            body = extract_body(
                data,
                {
                    "method": method,
                },
            )

    if params:
        lines.append(
            f"    params = {repr(params)}"
        )
    else:
        lines.append(
            "    params = None"
        )

    if body is not None:
        lines.append(
            f"    json_data = {repr(body)}"
        )
    else:
        lines.append(
            "    json_data = None"
        )

    lines.append("")

    if method == "GET":

        lines.append(
            "    response = requests.get("
            "url, params=params, timeout=15)"
        )

    elif method == "POST":

        lines.append(
            "    response = requests.post("
            "url, params=params, "
            "json=json_data, timeout=15)"
        )

    elif method == "PUT":

        lines.append(
            "    response = requests.put("
            "url, params=params, "
            "json=json_data, timeout=15)"
        )

    elif method == "PATCH":

        lines.append(
            "    response = requests.patch("
            "url, params=params, "
            "json=json_data, timeout=15)"
        )

    elif method == "DELETE":

        lines.append(
            "    response = requests.delete("
            "url, params=params, timeout=15)"
        )

    else:

        lines.append(
            "    response = requests.request("
            f'"{method}", url, '
            "params=params, "
            "json=json_data, "
            "timeout=15)"
        )

    lines.extend(
        [
            "",
            "    print('URL:', response.url)",
            "    print('Status:', response.status_code)",
            "    print('Response:', response.text)",
            "",
            f"    assert response.status_code == {expected_status_code}",
        ]
    )

    return "\n".join(lines)


# ============================================================
# 15. EXECUTE TEST CASE
# ============================================================

def execute_test_case(
    method,
    endpoint,
    request_data=None,
    expected_status_code=200,
):

    method = method.upper()

    endpoint = endpoint or "/"

    concrete_endpoint = build_concrete_endpoint(
        endpoint,
        request_data,
    )

    url = f"{BASE_URL}{concrete_endpoint}"

    data = clean_request_data(
        request_data
    )

    params = None
    body = None

    if isinstance(data, dict):

        query_parameters = data.get(
            "query_parameters"
        )

        if isinstance(
            query_parameters,
            dict,
        ):
            params = query_parameters

        if "body" in data:
            body = data.get(
                "body"
            )

        elif method in {
            "POST",
            "PUT",
            "PATCH",
        }:

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
            "url": response.url,
            "status_code": response.status_code,
            "response": response_body,
        }

        execution_status = (
            "PASS"
            if response.status_code
            == expected_status_code
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
# 16. FALLBACK TEST CASES
# ============================================================

def create_fallback_test_cases(api_info):

    method = api_info["method"]

    endpoint = api_info["endpoint"]

    path_parameters = find_path_parameters(
        endpoint
    )

    success_status = get_success_status_code(
        api_info,
        200,
    )

    validation_status = get_validation_status_code(
        api_info,
        422,
    )

    cases = []

    # --------------------------------------------------------
    # GET
    # --------------------------------------------------------

    if method == "GET":

        if path_parameters:

            parameter = path_parameters[0]

            cases.append(
                {
                    "title": "Valid Path Parameter",
                    "method": method,
                    "endpoint": endpoint,
                    "test_type": "Positive",
                    "description": (
                        "Verify the endpoint with a valid "
                        "path parameter."
                    ),
                    "request_data": {
                        "path_parameters": {
                            parameter: "1"
                        }
                    },
                    "expected_status_code": success_status,
                    "expected_result": (
                        "Successful response."
                    ),
                }
            )

            # Integer path parameters commonly produce 422
            # when supplied with non-numeric text.
            cases.append(
                {
                    "title": "Invalid Path Parameter Type",
                    "method": method,
                    "endpoint": endpoint,
                    "test_type": "Negative",
                    "description": (
                        "Verify validation behaviour when "
                        "the path parameter has an invalid type."
                    ),
                    "request_data": {
                        "path_parameters": {
                            parameter: "abc"
                        }
                    },
                    "expected_status_code": validation_status,
                    "expected_result": (
                        "Validation error."
                    ),
                }
            )

            cases.append(
                {
                    "title": "Non Existing Resource",
                    "method": method,
                    "endpoint": endpoint,
                    "test_type": "Negative",
                    "description": (
                        "Verify behaviour when the requested "
                        "resource does not exist."
                    ),
                    "request_data": {
                        "path_parameters": {
                            parameter: "999999"
                        }
                    },
                    "expected_status_code": 404,
                    "expected_result": (
                        "Resource should not be found."
                    ),
                }
            )

        else:

            query_parameters = {}

            for parameter in api_info.get(
                "query_parameters",
                [],
            ):

                if not isinstance(
                    parameter,
                    dict,
                ):
                    continue

                name = parameter.get(
                    "name"
                )

                if name:
                    query_parameters[name] = (
                        "1"
                    )

            cases.append(
                {
                    "title": "Valid GET Request",
                    "method": method,
                    "endpoint": endpoint,
                    "test_type": "Positive",
                    "description": (
                        "Verify that the GET endpoint "
                        "returns successfully."
                    ),
                    "request_data": {
                        "query_parameters":
                            query_parameters
                    },
                    "expected_status_code": success_status,
                    "expected_result": (
                        "Successful response."
                    ),
                }
            )

    # --------------------------------------------------------
    # POST
    # --------------------------------------------------------

    elif method == "POST":

        body = parse_request_body(
            api_info["request_body"]
        )

        cases.append(
            {
                "title": "Valid POST Request",
                "method": method,
                "endpoint": endpoint,
                "test_type": "Positive",
                "description": (
                    "Verify that the POST endpoint "
                    "accepts a valid request."
                ),
                "request_data": {
                    "body": body
                },
                "expected_status_code": success_status,
                "expected_result": (
                    "Successful response."
                ),
            }
        )

        cases.append(
            {
                "title": "Missing Request Body",
                "method": method,
                "endpoint": endpoint,
                "test_type": "Negative",
                "description": (
                    "Verify validation behaviour when "
                    "the request body is missing."
                ),
                "request_data": {
                    "body": None
                },
                "expected_status_code": validation_status,
                "expected_result": (
                    "Validation error."
                ),
            }
        )

        required_fields = get_required_body_fields(
            api_info
        )

        if required_fields:

            invalid_body = dict(body)

            field_to_remove = required_fields[0]

            invalid_body.pop(
                field_to_remove,
                None,
            )

            cases.append(
                {
                    "title": "Missing Required Field",
                    "method": method,
                    "endpoint": endpoint,
                    "test_type": "Negative",
                    "description": (
                        "Verify validation behaviour "
                        "when a required request field "
                        "is missing."
                    ),
                    "request_data": {
                        "body": invalid_body
                    },
                    "expected_status_code": validation_status,
                    "expected_result": (
                        "Validation error."
                    ),
                }
            )

    # --------------------------------------------------------
    # OTHER METHODS
    # --------------------------------------------------------

    else:

        cases.append(
            {
                "title": f"Valid {method} Request",
                "method": method,
                "endpoint": endpoint,
                "test_type": "Positive",
                "description": (
                    f"Verify that the {method} endpoint "
                    "responds successfully."
                ),
                "request_data": {},
                "expected_status_code": success_status,
                "expected_result": (
                    "Successful response."
                ),
            }
        )

    return cases


# ============================================================
# 17. NORMALIZE AI TEST CASES
# ============================================================

def normalize_test_cases(
    raw_cases,
    api_info,
):

    if isinstance(raw_cases, dict):

        if "test_cases" in raw_cases:

            raw_cases = raw_cases[
                "test_cases"
            ]

        elif "tests" in raw_cases:

            raw_cases = raw_cases[
                "tests"
            ]

        else:

            raw_cases = [
                raw_cases
            ]

    if not isinstance(
        raw_cases,
        list,
    ):
        return []

    actual_method = api_info["method"]

    actual_endpoint = api_info["endpoint"]

    normalized = []

    for item in raw_cases:

        if not isinstance(
            item,
            dict,
        ):
            continue

        # ----------------------------------------------------
        # Endpoint validation
        # ----------------------------------------------------

        generated_endpoint = str(
            item.get(
                "endpoint",
                actual_endpoint,
            )
        )

        # Completely unrelated endpoints are rejected.
        if not endpoint_matches_api(
            generated_endpoint,
            actual_endpoint,
        ):
            print(
                "Skipped AI test because endpoint "
                "does not match actual API:",
                generated_endpoint,
            )
            continue

        # ALWAYS use the real API endpoint template.
        endpoint = actual_endpoint

        # ----------------------------------------------------
        # Request data
        # ----------------------------------------------------

        request_data = clean_request_data(
            item.get(
                "request_data",
                {},
            )
        )

        if not isinstance(
            request_data,
            dict,
        ):
            request_data = {}

        # ----------------------------------------------------
        # Query parameters
        # ----------------------------------------------------

        query_data = normalize_query_parameters(
            request_data,
            api_info,
        )

        request_data[
            "query_parameters"
        ] = query_data

        # ----------------------------------------------------
        # Path parameters
        # ----------------------------------------------------

        path_data = normalize_path_parameters(
            request_data,
            api_info,
        )

        request_data[
            "path_parameters"
        ] = path_data

        # ----------------------------------------------------
        # Body
        # ----------------------------------------------------

        if "body" in request_data:

            body = request_data.get(
                "body"
            )

        elif actual_method in {
            "POST",
            "PUT",
            "PATCH",
        }:

            body = extract_body(
                request_data,
                api_info,
            )

            request_data[
                "body"
            ] = body

            # Remove accidental top-level fields.
            for key in list(
                request_data.keys()
            ):

                if key not in {
                    "path_parameters",
                    "query_parameters",
                    "body",
                }:

                    del request_data[key]

        # ----------------------------------------------------
        # Metadata
        # ----------------------------------------------------

        title = str(
            item.get(
                "title",
                f"{actual_method} "
                f"{actual_endpoint} Test",
            )
        )

        test_type = str(
            item.get(
                "test_type",
                "Functional",
            )
        )

        description = str(
            item.get(
                "description",
                "Verify API behaviour.",
            )
        )

        expected_status_code = (
            get_expected_status_code(
                item,
                api_info,
                200,
            )
        )

        expected_result = str(
            item.get(
                "expected_result",
                "Expected HTTP response.",
            )
        )

        # ----------------------------------------------------
        # Semantic validation
        # ----------------------------------------------------

        title_lower = title.lower()
        description_lower = description.lower()
        combined = (
            title_lower
            + " "
            + description_lower
        )

        # If AI says it is a query test, make sure
        # an actual query parameter exists.
        if (
            "query" in combined
            and api_info.get(
                "query_parameters"
            )
        ):

            if not query_data:

                print(
                    "Skipped query test without "
                    "actual query parameters:",
                    title,
                )

                continue

        # If API has no query parameters, remove
        # accidental query data.
        if not api_info.get(
            "query_parameters"
        ):

            request_data[
                "query_parameters"
            ] = {}

        # Path API must contain actual path data.
        if find_path_parameters(
            actual_endpoint
        ):

            if not path_data:

                # For a positive test we can safely
                # provide a default path value.
                if (
                    "positive"
                    in test_type.lower()
                ):

                    parameter = (
                        find_path_parameters(
                            actual_endpoint
                        )[0]
                    )

                    request_data[
                        "path_parameters"
                    ] = {
                        parameter: "1"
                    }

                else:

                    print(
                        "Skipped path test without "
                        "path parameter data:",
                        title,
                    )

                    continue

        # ----------------------------------------------------
        # Store normalized test
        # ----------------------------------------------------

        normalized.append(
            {
                "title": title,
                "method": actual_method,
                "endpoint": endpoint,
                "test_type": test_type,
                "description": description,
                "request_data": request_data,
                "expected_status_code":
                    expected_status_code,
                "expected_result":
                    expected_result,
            }
        )

    return normalized


# ============================================================
# 18. AI TEST GENERATION
# ============================================================

def generate_ai_test_cases(api):

    api_info = analyze_api_structure(
        api
    )

    method = api_info["method"]

    endpoint = api_info["endpoint"]

    openapi_details = api_info[
        "openapi_details"
    ]

    documented_status_codes = (
        get_openapi_status_codes(
            api_info
        )
    )

    success_status = (
        get_success_status_code(
            api_info,
            200,
        )
    )

    validation_status = (
        get_validation_status_code(
            api_info,
            422,
        )
    )

    query_parameters = (
        api_info.get(
            "query_parameters",
            []
        )
    )

    path_parameters = (
        api_info.get(
            "path_parameters",
            []
        )
    )

    body_properties = (
        get_body_properties(
            api_info
        )
    )

    required_body_fields = (
        get_required_body_fields(
            api_info
        )
    )

    # ========================================================
    # STRICT AI PROMPT
    # ========================================================

    prompt = f"""
You are an expert API test engineer.

Generate test scenarios for ONLY this API.

HTTP METHOD:
{method}

EXACT ENDPOINT:
{endpoint}

REQUEST BODY:
{api_info["request_body"]}

OPENAPI DETAILS:
{json.dumps(
    openapi_details,
    indent=2
)}

PATH PARAMETERS:
{json.dumps(
    path_parameters,
    indent=2
)}

QUERY PARAMETERS:
{json.dumps(
    query_parameters,
    indent=2
)}

BODY PROPERTIES:
{json.dumps(
    body_properties,
    indent=2
)}

REQUIRED BODY FIELDS:
{json.dumps(
    required_body_fields,
    indent=2
)}

DOCUMENTED STATUS CODES:
{documented_status_codes}

SUCCESS STATUS:
{success_status}

VALIDATION STATUS:
{validation_status}

ABSOLUTE RULES:

1. Generate tests ONLY for:
   {method} {endpoint}

2. NEVER invent another endpoint.

3. NEVER invent another HTTP method.

4. If this endpoint has NO path parameters,
   DO NOT generate path parameter tests.

5. If this endpoint has NO query parameters,
   DO NOT generate query parameter tests.

6. Use EXACT OpenAPI path parameter names.

7. Use EXACT OpenAPI query parameter names.

8. Query parameters MUST be inside:
   "query_parameters"

9. Request body fields MUST be inside:
   "body"

10. Do not put query parameters inside body.

11. Do not put body fields inside query_parameters.

12. Only use fields actually defined by the request body.

13. A missing-required-field test must actually remove
    a required field.

14. A too-long test must actually use a long value AND
    only generate it if maxLength is documented.

15. A too-short test must actually use a short value AND
    only generate it if minLength is documented.

16. A minimum boundary test must use the documented minimum.

17. A maximum boundary test must use the documented maximum.

18. If no boundary constraint exists, DO NOT call an
    arbitrary value a boundary test.

19. An invalid test must actually contain an invalid value.

20. An invalid integer parameter should use a non-numeric
    value such as "abc".

21. A non-existing numeric resource should use 999999.

22. Never claim to test an invalid path parameter while
    sending a valid path parameter.

23. Never claim to test limit=10 while sending no limit.

24. Never claim to test an empty value while sending a
    non-empty value.

25. Do not assume POST returns 201.

26. Prefer documented response codes.

27. FastAPI validation commonly returns 422.

28. Generate only useful tests.

29. Do not create fake tests just to increase the count.

30. Generate approximately 5 to 10 useful tests when
    enough information exists.

31. Every title, description, endpoint and request_data
    must describe the SAME test.

RETURN ONLY VALID JSON.

FORMAT:

{{
  "test_cases": [
    {{
      "title": "Test title",
      "method": "{method}",
      "endpoint": "{endpoint}",
      "test_type": "Positive",
      "description": "What this test verifies",
      "request_data": {{
        "path_parameters": {{}},
        "query_parameters": {{}},
        "body": {{}}
      }},
      "expected_status_code": {success_status},
      "expected_result": "Expected HTTP behaviour"
    }}
  ]
}}
"""

    # ========================================================
    # CALL OLLAMA
    # ========================================================

    try:

        ai_response = call_ollama(
            prompt
        )

        parsed = extract_json(
            ai_response
        )

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

    # ========================================================
    # FALLBACK
    # ========================================================

    if not test_cases:

        test_cases = (
            create_fallback_test_cases(
                api_info
            )
        )

    # ========================================================
    # EXECUTE TESTS
    # ========================================================

    final_cases = []

    for test_case in test_cases:

        request_data = test_case[
            "request_data"
        ]

        expected_status_code = (
            test_case[
                "expected_status_code"
            ]
        )

        # IMPORTANT:
        # Keep canonical endpoint until execution.
        executable_endpoint = (
            build_concrete_endpoint(
                test_case["endpoint"],
                request_data,
            )
        )

        # Store concrete endpoint for display.
        test_case["endpoint"] = (
            executable_endpoint
        )

        # ----------------------------------------------------
        # Generate executable Python
        # ----------------------------------------------------

        test_case[
            "test_code"
        ] = generate_test_code(
            method=test_case[
                "method"
            ],
            endpoint=executable_endpoint,
            request_data=request_data,
            expected_status_code=
                expected_status_code,
        )

        # ----------------------------------------------------
        # Execute actual request
        # ----------------------------------------------------

        execution = execute_test_case(
            method=test_case[
                "method"
            ],
            endpoint=executable_endpoint,
            request_data=request_data,
            expected_status_code=
                expected_status_code,
        )

        test_case[
            "actual_result"
        ] = execution[
            "actual_result"
        ]

        test_case[
            "execution_status"
        ] = execution[
            "execution_status"
        ]

        final_cases.append(
            test_case
        )

    return final_cases