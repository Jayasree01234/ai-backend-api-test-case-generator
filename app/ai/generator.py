
import json
import re
import requests


# ============================================================
# CONFIGURATION
# ============================================================

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"

BASE_URL = "http://127.0.0.1:8000"

OLLAMA_TIMEOUT = 15
REQUEST_TIMEOUT = 15


# ============================================================
# BASIC HELPERS
# ============================================================

def safe_int(value, default=None):
    try:
        return int(value)
    except Exception:
        return default


def clean_request_data(value):
    if value is None:
        return {}

    if isinstance(value, (dict, list, int, float, bool)):
        return value

    if isinstance(value, str):
        value = value.strip()

        if not value:
            return {}

        try:
            return json.loads(value)
        except Exception:
            return value

    return str(value)


def parse_json(value):
    if isinstance(value, dict):
        return value

    if not isinstance(value, str):
        return {}

    value = value.strip()

    if not value:
        return {}

    try:
        parsed = json.loads(value)

        if isinstance(parsed, dict):
            return parsed

        return {}

    except Exception:
        return {}


# ============================================================
# READ API INFORMATION
# ============================================================

def analyze_api_structure(api):

    details = {}

    raw_details = getattr(
        api,
        "openapi_details",
        None,
    )

    if raw_details:

        try:

            if isinstance(
                raw_details,
                str,
            ):
                details = json.loads(
                    raw_details
                )

            elif isinstance(
                raw_details,
                dict,
            ):
                details = raw_details

        except Exception:
            details = {}

    if not isinstance(
        details,
        dict,
    ):
        details = {}

    parameters = details.get(
        "parameters",
        [],
    )

    if not isinstance(
        parameters,
        list,
    ):
        parameters = []

    path_parameters = []
    query_parameters = []
    header_parameters = []

    for parameter in parameters:

        if not isinstance(
            parameter,
            dict,
        ):
            continue

        name = parameter.get(
            "name"
        )

        location = parameter.get(
            "in"
        )

        if not name:
            continue

        if location == "path":

            path_parameters.append(
                parameter
            )

        elif location == "query":

            query_parameters.append(
                parameter
            )

        elif location == "header":

            header_parameters.append(
                parameter
            )

    responses = details.get(
        "responses",
        {},
    )

    if not isinstance(
        responses,
        dict,
    ):
        responses = {}

    return {
        "method": str(
            getattr(
                api,
                "method",
                "GET",
            ) or "GET"
        ).upper(),

        "endpoint": str(
            getattr(
                api,
                "endpoint",
                "/",
            ) or "/"
        ),

        "request_body": getattr(
            api,
            "request_body",
            ""
        ) or "",

        "openapi_details": details,

        "parameters": parameters,

        "path_parameters": path_parameters,

        "query_parameters": query_parameters,

        "header_parameters": header_parameters,

        "responses": responses,
    }


# ============================================================
# OLLAMA
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
        timeout=OLLAMA_TIMEOUT,
    )

    response.raise_for_status()

    data = response.json()

    return data.get(
        "response",
        "",
    )


def extract_json(text):

    if not text:
        return {}

    text = str(text).strip()

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
            return json.loads(
                match.group(1)
            )

        except Exception:
            pass

    start = text.find("{")
    end = text.rfind("}")

    if (
        start != -1
        and end != -1
        and end > start
    ):

        try:
            return json.loads(
                text[start:end + 1]
            )

        except Exception:
            pass

    return {}


# ============================================================
# OPENAPI PARAMETERS
# ============================================================

def find_path_parameters(endpoint):

    if not endpoint:
        return []

    return re.findall(
        r"\{([^{}]+)\}",
        str(endpoint),
    )


def get_path_parameter_names(api_info):

    names = []

    for parameter in api_info.get(
        "path_parameters",
        [],
    ):

        if isinstance(
            parameter,
            dict,
        ):

            name = parameter.get(
                "name"
            )

            if (
                name
                and name not in names
            ):
                names.append(name)

    for name in find_path_parameters(
        api_info["endpoint"]
    ):

        if name not in names:
            names.append(name)

    return names


def get_query_parameter_names(
    api_info
):

    names = []

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
            names.append(name)

    return names


def get_parameter_schema(
    parameter
):

    if not isinstance(
        parameter,
        dict,
    ):
        return {}

    schema = parameter.get(
        "schema"
    )

    if isinstance(
        schema,
        dict,
    ):
        return schema

    return {}


def get_parameter_type(
    parameter
):

    schema = get_parameter_schema(
        parameter
    )

    return schema.get(
        "type",
        parameter.get(
            "type",
            "string",
        ),
    )


# ============================================================
# OPENAPI STATUS CODES
# ============================================================

def get_openapi_status_codes(
    api_info
):

    responses = api_info.get(
        "responses",
        {},
    )

    if not isinstance(
        responses,
        dict,
    ):
        return []

    result = []

    for key in responses.keys():

        code = safe_int(key)

        if (
            code is not None
            and 100 <= code <= 599
        ):
            result.append(code)

    return sorted(
        set(result)
    )


def get_success_status_code(
    api_info,
    default=200,
):

    codes = get_openapi_status_codes(
        api_info
    )

    success_codes = [
        code
        for code in codes
        if 200 <= code <= 299
    ]

    if success_codes:
        return success_codes[0]

    return default


def get_validation_status_code(
    api_info,
    default=422,
):

    codes = get_openapi_status_codes(
        api_info
    )

    if 422 in codes:
        return 422

    return default


# ============================================================
# BODY / SCHEMA HELPERS
# ============================================================

def get_body_schema(
    api_info
):

    details = api_info.get(
        "openapi_details",
        {},
    )

    if not isinstance(
        details,
        dict,
    ):
        return {}

    request_body = details.get(
        "requestBody"
    )

    if not isinstance(
        request_body,
        dict,
    ):
        return {}

    content = request_body.get(
        "content",
        {},
    )

    if not isinstance(
        content,
        dict,
    ):
        return {}

    json_content = content.get(
        "application/json"
    )

    if not isinstance(
        json_content,
        dict,
    ):
        return {}

    schema = json_content.get(
        "schema",
        {},
    )

    if not isinstance(
        schema,
        dict,
    ):
        return {}

    return schema


# ============================================================
# NEW:
# HANDLE REQUEST BODY STORED AS OPENAPI DEFINITION
# ============================================================

def get_manual_body_value(
    api_info
):

    manual_body = api_info.get(
        "request_body",
        "",
    )

    if not manual_body:
        return None

    parsed_body = parse_json(
        manual_body
    )

    if not parsed_body:
        return None

    # --------------------------------------------------------
    # IMPORTANT:
    #
    # Sometimes imported OpenAPI information is stored inside
    # the database request_body field like this:
    #
    # {
    #   "required": true,
    #   "content": {
    #       "application/json": {
    #           "schema": {...}
    #       }
    #   }
    # }
    #
    # That is NOT actual request JSON.
    #
    # Detect it and return None so the OpenAPI schema is used.
    # --------------------------------------------------------

    if (
        "content" in parsed_body
        and isinstance(
            parsed_body.get(
                "content"
            ),
            dict,
        )
    ):

        return None

    if (
        "schema" in parsed_body
        and isinstance(
            parsed_body.get(
                "schema"
            ),
            dict,
        )
    ):

        return None

    # --------------------------------------------------------
    # Otherwise it is a real manually-entered JSON body.
    # --------------------------------------------------------

    return parsed_body


def get_body_properties(
    api_info
):

    # --------------------------------------------------------
    # OpenAPI schema first.
    # --------------------------------------------------------

    schema = get_body_schema(
        api_info
    )

    properties = schema.get(
        "properties",
        {},
    )

    if isinstance(
        properties,
        dict,
    ) and properties:

        return properties

    # --------------------------------------------------------
    # Manual JSON body.
    # --------------------------------------------------------

    manual_body = (
        get_manual_body_value(
            api_info
        )
    )

    if isinstance(
        manual_body,
        dict,
    ):

        return {
            key: {
                "type": (
                    "string"
                    if isinstance(
                        value,
                        str,
                    )
                    else (
                        "integer"
                        if isinstance(
                            value,
                            int,
                        )
                        else (
                            "number"
                            if isinstance(
                                value,
                                float,
                            )
                            else (
                                "boolean"
                                if isinstance(
                                    value,
                                    bool,
                                )
                                else "object"
                            )
                        )
                    )
                ),
                "example": value,
            }
            for key, value
            in manual_body.items()
        }

    return {}


def get_required_body_fields(
    api_info
):

    schema = get_body_schema(
        api_info
    )

    required = schema.get(
        "required",
        [],
    )

    if isinstance(
        required,
        list,
    ):
        return required

    # For manually-created JSON,
    # treat all supplied fields as available fields,
    # but do not assume they are required.
    return []


def has_request_body(
    api_info
):

    method = api_info[
        "method"
    ]

    if method not in {
        "POST",
        "PUT",
        "PATCH",
    }:
        return False

    details = api_info.get(
        "openapi_details",
        {},
    )

    if isinstance(
        details.get(
            "requestBody"
        ),
        dict,
    ):
        return True

    manual_body = (
        get_manual_body_value(
            api_info
        )
    )

    return isinstance(
        manual_body,
        dict,
    )


# ============================================================
# CREATE REAL SAMPLE DATA
# ============================================================

def example_value_from_schema(
    schema,
    field_name="field",
):

    if not isinstance(
        schema,
        dict,
    ):
        return "test"

    schema_type = schema.get(
        "type",
        "string",
    )

    fmt = schema.get(
        "format"
    )

    if "example" in schema:
        return schema["example"]

    if "default" in schema:
        return schema["default"]

    if "enum" in schema:

        enum_values = schema.get(
            "enum"
        )

        if (
            isinstance(
                enum_values,
                list,
            )
            and enum_values
        ):
            return enum_values[0]

    if schema_type == "integer":

        minimum = schema.get(
            "minimum"
        )

        if minimum is not None:
            return int(minimum)

        return 25

    if schema_type == "number":

        minimum = schema.get(
            "minimum"
        )

        if minimum is not None:
            return minimum

        return 25

    if schema_type == "boolean":
        return True

    if schema_type == "array":

        item_schema = schema.get(
            "items",
            {},
        )

        return [
            example_value_from_schema(
                item_schema,
                field_name,
            )
        ]

    if schema_type == "object":
        return {}

    if fmt == "email":
        return "john@example.com"

    if fmt == "date":
        return "2026-01-01"

    if fmt == "date-time":
        return "2026-01-01T10:00:00"

    lower_name = str(
        field_name
    ).lower()

    if "email" in lower_name:
        return "john@example.com"

    if "name" in lower_name:
        return "John"

    if "phone" in lower_name:
        return "9876543210"

    if "password" in lower_name:
        return "Test@12345"

    return "test"


# ============================================================
# BUILD VALID BODY
# ============================================================

def build_valid_body(
    api_info
):

    # --------------------------------------------------------
    # 1. OpenAPI schema.
    # --------------------------------------------------------

    properties = get_body_properties(
        api_info
    )

    required = get_required_body_fields(
        api_info
    )

    if properties:

        body = {}

        # Required fields first.
        for field_name, schema in properties.items():

            if field_name in required:

                body[field_name] = (
                    example_value_from_schema(
                        schema,
                        field_name,
                    )
                )

        # If OpenAPI has no required list,
        # use all fields.
        if not body:

            for field_name, schema in properties.items():

                body[field_name] = (
                    example_value_from_schema(
                        schema,
                        field_name,
                    )
                )

        return body

    # --------------------------------------------------------
    # 2. Manually-created JSON body.
    # --------------------------------------------------------

    manual_body = (
        get_manual_body_value(
            api_info
        )
    )

    if isinstance(
        manual_body,
        dict,
    ):
        return manual_body

    return {}


# ============================================================
# MISSING REQUIRED FIELD
# ============================================================

def build_missing_required_body(
    api_info
):

    required = get_required_body_fields(
        api_info
    )

    if not required:
        return None

    body = build_valid_body(
        api_info
    )

    if not isinstance(
        body,
        dict,
    ):
        return None

    field_to_remove = required[0]

    body.pop(
        field_to_remove,
        None,
    )

    return body


# ============================================================
# BOUNDARY BODY
# ============================================================

def build_boundary_body(
    api_info,
    field_name,
    boundary_type,
):

    body = build_valid_body(
        api_info
    )

    properties = get_body_properties(
        api_info
    )

    schema = properties.get(
        field_name,
        {},
    )

    if not isinstance(
        schema,
        dict,
    ):
        return body

    if boundary_type == "minimum":

        if "minimum" not in schema:
            return None

        body[field_name] = (
            schema["minimum"]
        )

    elif boundary_type == "maximum":

        if "maximum" not in schema:
            return None

        body[field_name] = (
            schema["maximum"]
        )

    elif boundary_type == "below_minimum":

        if "minimum" not in schema:
            return None

        body[field_name] = (
            schema["minimum"] - 1
        )

    elif boundary_type == "above_maximum":

        if "maximum" not in schema:
            return None

        body[field_name] = (
            schema["maximum"] + 1
        )

    else:
        return None

    return body


# ============================================================
# DETECT OPENAPI SCHEMA OBJECT
# ============================================================

def is_schema_object(
    value
):

    if not isinstance(
        value,
        dict,
    ):
        return False

    schema_keys = {
        "required",
        "content",
        "properties",
        "schema",
    }

    return bool(
        set(value.keys()).intersection(
            schema_keys
        )
    )


# ============================================================
# PATH HELPERS
# ============================================================

def build_concrete_endpoint(
    endpoint,
    request_data=None,
):

    if not endpoint:
        return "/"

    endpoint = str(
        endpoint
    )

    parameters = (
        find_path_parameters(
            endpoint
        )
    )

    if not parameters:
        return endpoint

    path_values = {}

    if isinstance(
        request_data,
        dict,
    ):

        supplied = request_data.get(
            "path_parameters",
            {},
        )

        if isinstance(
            supplied,
            dict,
        ):
            path_values.update(
                supplied
            )

    for parameter in parameters:

        value = path_values.get(
            parameter
        )

        if value is None:
            value = "1"

        endpoint = endpoint.replace(
            "{" + parameter + "}",
            str(value),
        )

    return endpoint


# ============================================================
# QUERY HELPERS
# ============================================================

def build_default_query_parameters(
    api_info
):

    result = {}

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

        if not name:
            continue

        parameter_type = (
            get_parameter_type(
                parameter
            )
        )

        if parameter_type == "integer":

            result[name] = 1

        elif parameter_type == "number":

            result[name] = 1

        elif parameter_type == "boolean":

            result[name] = True

        else:

            result[name] = "test"

    return result


# ============================================================
# TEST CASE BUILDER
# ============================================================

def make_test(
    title,
    method,
    endpoint,
    test_type,
    description,
    request_data,
    expected_status_code,
    expected_result,
):

    return {
        "title": title,
        "method": method,
        "endpoint": endpoint,
        "test_type": test_type,
        "description": description,
        "request_data": request_data,
        "expected_status_code": expected_status_code,
        "expected_result": expected_result,
    }


# ============================================================
# DETERMINISTIC TEST GENERATION
# ============================================================

def create_fallback_test_cases(
    api_info
):

    method = api_info[
        "method"
    ]

    endpoint = api_info[
        "endpoint"
    ]

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

    cases = []

    # ========================================================
    # GET WITH PATH PARAMETER
    # ========================================================

    path_names = (
        get_path_parameter_names(
            api_info
        )
    )

    if (
        method == "GET"
        and path_names
    ):

        parameter = path_names[0]

        parameter_schema = {}

        for item in api_info.get(
            "path_parameters",
            [],
        ):

            if (
                isinstance(
                    item,
                    dict,
                )
                and item.get(
                    "name"
                ) == parameter
            ):

                parameter_schema = (
                    get_parameter_schema(
                        item
                    )
                )

                break

        parameter_type = (
            parameter_schema.get(
                "type",
                "string",
            )
        )

        valid_value = "1"

        if parameter_type == "integer":
            valid_value = 1

        cases.append(
            make_test(
                "Valid Path Parameter",
                method,
                endpoint,
                "Positive",
                "Verify the endpoint with a valid path parameter.",
                {
                    "path_parameters": {
                        parameter: valid_value
                    }
                },
                success_status,
                "The API should return a successful response.",
            )
        )

        if parameter_type == "integer":

            cases.append(
                make_test(
                    "Invalid Path Parameter Type",
                    method,
                    endpoint,
                    "Negative",
                    "Verify that a non-numeric path parameter is rejected.",
                    {
                        "path_parameters": {
                            parameter: "abc"
                        }
                    },
                    validation_status,
                    "The API should return a validation error.",
                )
            )

            cases.append(
                make_test(
                    "Non Existing Resource",
                    method,
                    endpoint,
                    "Negative",
                    "Verify that a request for a non-existing resource is rejected.",
                    {
                        "path_parameters": {
                            parameter: 999999
                        }
                    },
                    404,
                    "The API should return resource not found.",
                )
            )

        return cases

    # ========================================================
    # NORMAL GET
    # ========================================================

    if method == "GET":

        query = (
            build_default_query_parameters(
                api_info
            )
        )

        cases.append(
            make_test(
                "Valid GET Request",
                method,
                endpoint,
                "Positive",
                "Verify that the GET endpoint returns successfully.",
                {
                    "query_parameters": query
                },
                success_status,
                "The API should return a successful response.",
            )
        )

        return cases

    # ========================================================
    # POST / PUT / PATCH
    # ========================================================

    if method in {
        "POST",
        "PUT",
        "PATCH",
    }:

        manual_body = api_info.get(
            "request_body",
            ""
        ) or ""

        schema_body = get_body_schema(
            api_info
        )

        actual_manual_body = (
            get_manual_body_value(
                api_info
            )
        )

        has_manual_body = (
            isinstance(
                actual_manual_body,
                dict,
            )
            and bool(
                actual_manual_body
            )
        )

        has_openapi_body = bool(
            schema_body
        )

        # ----------------------------------------------------
        # NO BODY INFORMATION
        # ----------------------------------------------------

        if (
            not has_manual_body
            and not has_openapi_body
        ):

            cases.append(
                make_test(
                    "Missing Request Body",
                    method,
                    endpoint,
                    "Negative",
                    "Verify that the API rejects a request without the required request body.",
                    {
                        "body": {},
                        "query_parameters": {},
                        "path_parameters": {},
                    },
                    validation_status,
                    "The API should return a validation error when the request body is missing.",
                )
            )

            return cases

        # ----------------------------------------------------
        # VALID REQUEST
        # ----------------------------------------------------

        valid_body = build_valid_body(
            api_info
        )

        cases.append(
            make_test(
                f"Valid {method} Request",
                method,
                endpoint,
                "Positive",
                "Verify the endpoint with valid request data.",
                {
                    "body": valid_body,
                    "query_parameters": {},
                    "path_parameters": {},
                },
                success_status,
                "The API should accept valid request data.",
            )
        )

        # ----------------------------------------------------
        # MISSING REQUIRED FIELD
        # ----------------------------------------------------

        missing_body = (
            build_missing_required_body(
                api_info
            )
        )

        if missing_body is not None:

            cases.append(
                make_test(
                    "Missing Required Field",
                    method,
                    endpoint,
                    "Negative",
                    "Verify that a request missing a required field is rejected.",
                    {
                        "body": missing_body,
                        "query_parameters": {},
                        "path_parameters": {},
                    },
                    validation_status,
                    "The API should return a validation error.",
                )
            )

        # ----------------------------------------------------
        # BOUNDARY TESTS
        # ----------------------------------------------------

        properties = (
            get_body_properties(
                api_info
            )
        )

        for field_name, schema in properties.items():

            if not isinstance(
                schema,
                dict,
            ):
                continue

            if "minimum" in schema:

                body = build_boundary_body(
                    api_info,
                    field_name,
                    "minimum",
                )

                if body is not None:

                    cases.append(
                        make_test(
                            f"Minimum Boundary - {field_name}",
                            method,
                            endpoint,
                            "Boundary",
                            f"Verify the minimum allowed value for {field_name}.",
                            {
                                "body": body,
                                "query_parameters": {},
                                "path_parameters": {},
                            },
                            success_status,
                            "The API should accept the documented minimum value.",
                        )
                    )

            if "maximum" in schema:

                body = build_boundary_body(
                    api_info,
                    field_name,
                    "maximum",
                )

                if body is not None:

                    cases.append(
                        make_test(
                            f"Maximum Boundary - {field_name}",
                            method,
                            endpoint,
                            "Boundary",
                            f"Verify the maximum allowed value for {field_name}.",
                            {
                                "body": body,
                                "query_parameters": {},
                                "path_parameters": {},
                            },
                            success_status,
                            "The API should accept the documented maximum value.",
                        )
                    )

        return cases

    # ========================================================
    # OTHER METHODS
    # ========================================================

    cases.append(
        make_test(
            f"Valid {method} Request",
            method,
            endpoint,
            "Positive",
            f"Verify that the {method} endpoint responds successfully.",
            {
                "query_parameters": {},
                "path_parameters": {},
            },
            success_status,
            "The API should return a successful response.",
        )
    )

    return cases


# ============================================================
# EXECUTABLE PYTHON CODE
# ============================================================

def generate_test_code(
    method,
    endpoint,
    request_data=None,
    expected_status_code=200,
):

    method = str(
        method
    ).upper()

    endpoint = endpoint or "/"

    url = f"{BASE_URL}{endpoint}"

    data = request_data or {}

    query_parameters = {}

    body = None

    if isinstance(
        data,
        dict,
    ):

        query_parameters = data.get(
            "query_parameters",
            {},
        )

        if not isinstance(
            query_parameters,
            dict,
        ):
            query_parameters = {}

        body = data.get(
            "body"
        )

        if is_schema_object(
            body
        ):
            body = None

    lines = [
        "import requests",
        "",
        f'BASE_URL = "{BASE_URL}"',
        "",
        "def test_api():",
        f'    url = "{url}"',
        f"    params = {repr(query_parameters)}",
        f"    json_data = {repr(body)}",
        "",
    ]

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

    return "\n".join(
        lines
    )


# ============================================================
# EXECUTE TEST
# ============================================================

def execute_test_case(
    method,
    endpoint,
    request_data=None,
    expected_status_code=200,
):

    method = str(
        method
    ).upper()

    endpoint = endpoint or "/"

    concrete_endpoint = (
        build_concrete_endpoint(
            endpoint,
            request_data,
        )
    )

    url = f"{BASE_URL}{concrete_endpoint}"

    data = request_data or {}

    params = {}

    body = None

    if isinstance(
        data,
        dict,
    ):

        params = data.get(
            "query_parameters",
            {},
        )

        if not isinstance(
            params,
            dict,
        ):
            params = {}

        body = data.get(
            "body"
        )

        if is_schema_object(
            body
        ):
            body = None

    try:

        if method == "GET":

            response = requests.get(
                url,
                params=params,
                timeout=REQUEST_TIMEOUT,
            )

        elif method == "POST":

            response = requests.post(
                url,
                params=params,
                json=body,
                timeout=REQUEST_TIMEOUT,
            )

        elif method == "PUT":

            response = requests.put(
                url,
                params=params,
                json=body,
                timeout=REQUEST_TIMEOUT,
            )

        elif method == "PATCH":

            response = requests.patch(
                url,
                params=params,
                json=body,
                timeout=REQUEST_TIMEOUT,
            )

        elif method == "DELETE":

            response = requests.delete(
                url,
                params=params,
                timeout=REQUEST_TIMEOUT,
            )

        else:

            response = requests.request(
                method,
                url,
                params=params,
                json=body,
                timeout=REQUEST_TIMEOUT,
            )

        try:

            response_body = (
                response.json()
            )

        except Exception:

            response_body = (
                response.text
            )

        actual_result = {
            "url": response.url,
            "status_code": response.status_code,
            "response": response_body,
        }

        status = (
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

            "execution_status": status,

            "actual_status_code": (
                response.status_code
            ),
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
# OPTIONAL AI DESCRIPTION ENHANCEMENT
# ============================================================

def try_ai_description(
    test_cases,
    api_info,
):

    """
    Ollama only improves titles and descriptions.

    It cannot change:
    - method
    - endpoint
    - request data
    - expected status
    - test type
    """

    if not test_cases:
        return test_cases

    prompt = f"""
You are an API testing expert.

Improve only the titles and descriptions of these test cases.

DO NOT change:
- method
- endpoint
- request_data
- expected_status_code
- test_type

API:
{api_info["method"]} {api_info["endpoint"]}

TEST CASES:
{json.dumps(test_cases, indent=2)}

Return JSON:

{{
  "test_cases": [
    {{
      "title": "...",
      "description": "..."
    }}
  ]
}}
"""

    try:

        response = call_ollama(
            prompt
        )

        parsed = extract_json(
            response
        )

        suggestions = parsed.get(
            "test_cases",
            [],
        )

        if not isinstance(
            suggestions,
            list,
        ):
            return test_cases

        for index, suggestion in enumerate(
            suggestions
        ):

            if index >= len(
                test_cases
            ):
                break

            if not isinstance(
                suggestion,
                dict,
            ):
                continue

            title = suggestion.get(
                "title"
            )

            description = suggestion.get(
                "description"
            )

            if title:

                test_cases[index][
                    "title"
                ] = str(
                    title
                )

            if description:

                test_cases[index][
                    "description"
                ] = str(
                    description
                )

    except Exception as exc:

        print(
            "Ollama enhancement skipped:",
            str(exc),
        )

    return test_cases


# ============================================================
# FINAL GENERATOR
# ============================================================

def generate_ai_test_cases(
    api
):

    # --------------------------------------------------------
    # 1. Analyze API.
    # --------------------------------------------------------

    api_info = (
        analyze_api_structure(
            api
        )
    )

    # --------------------------------------------------------
    # 2. Generate deterministic tests.
    # --------------------------------------------------------

    test_cases = (
        create_fallback_test_cases(
            api_info
        )
    )

    # --------------------------------------------------------
    # 3. Optional Ollama enhancement.
    # --------------------------------------------------------

    test_cases = (
        try_ai_description(
            test_cases,
            api_info,
        )
    )

    # --------------------------------------------------------
    # 4. Execute every test.
    # --------------------------------------------------------

    final_cases = []

    for test_case in test_cases:

        request_data = (
            test_case.get(
                "request_data",
                {},
            )
        )

        expected_status_code = (
            safe_int(
                test_case.get(
                    "expected_status_code",
                    200,
                ),
                200,
            )
        )

        executable_endpoint = (
            build_concrete_endpoint(
                test_case[
                    "endpoint"
                ],
                request_data,
            )
        )

        # ----------------------------------------------------
        # Generate executable Python code.
        # ----------------------------------------------------

        test_case[
            "test_code"
        ] = generate_test_code(
            method=test_case[
                "method"
            ],
            endpoint=executable_endpoint,
            request_data=request_data,
            expected_status_code=expected_status_code,
        )

        # ----------------------------------------------------
        # Execute the test.
        # ----------------------------------------------------

        execution = execute_test_case(
            method=test_case[
                "method"
            ],
            endpoint=executable_endpoint,
            request_data=request_data,
            expected_status_code=expected_status_code,
        )

        test_case[
            "endpoint"
        ] = executable_endpoint

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
