import json
import re
from typing import Any, Dict, List, Optional

import requests


OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"
OLLAMA_TIMEOUT = 300


# ============================================================
# BASIC HELPERS
# ============================================================

def parse_json(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value

    if isinstance(value, str):
        value = value.strip()

        if not value:
            return {}

        try:
            parsed = json.loads(value)

            if isinstance(parsed, dict):
                return parsed

        except json.JSONDecodeError:
            pass

    return {}


def parse_openapi_details(value: Any) -> Dict[str, Any]:
    return parse_json(value)


def normalize_request_data(value: Any) -> Dict[str, Any]:
    """
    Converts stored request data into a dictionary.

    Important:
    OpenAPI requestBody definitions are NOT considered
    actual request data.
    """

    if isinstance(value, dict):
        return value

    if isinstance(value, str):
        value = value.strip()

        if not value:
            return {}

        try:
            parsed = json.loads(value)

            if isinstance(parsed, dict):
                return parsed

        except json.JSONDecodeError:
            pass

    return {}


def clean_json_response(text: str) -> Any:
    if not text:
        return None

    text = text.strip()

    text = re.sub(
        r"^```json\s*",
        "",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"^```\s*",
        "",
        text
    )

    text = re.sub(
        r"\s*```$",
        "",
        text
    )

    try:
        return json.loads(text)

    except json.JSONDecodeError:
        pass

    start = text.find("[")

    end = text.rfind("]")

    if start != -1 and end != -1 and end > start:

        try:
            return json.loads(
                text[start:end + 1]
            )

        except json.JSONDecodeError:
            pass

    start = text.find("{")

    end = text.rfind("}")

    if start != -1 and end != -1 and end > start:

        try:
            return json.loads(
                text[start:end + 1]
            )

        except json.JSONDecodeError:
            pass

    return None


def normalize_test_type(value: Any) -> str:

    value = str(
        value or ""
    ).strip().lower()

    if value in {
        "positive",
        "valid",
        "success"
    }:
        return "Positive"

    if value in {
        "negative",
        "invalid",
        "failure",
        "fail"
    }:
        return "Negative"

    if value in {
        "edge",
        "boundary",
        "boundary value"
    }:
        return "Edge"

    if value in {
        "security",
        "non-functional",
        "non functional"
    }:
        return "Security"

    return "Negative"


def safe_json_string(value: Any) -> str:

    try:

        return json.dumps(
            value,
            sort_keys=True,
            separators=(",", ":")
        )

    except Exception:

        return "{}"


# ============================================================
# OPENAPI HELPERS
# ============================================================

def find_matching_openapi_path(
    endpoint: str,
    openapi_details: Dict[str, Any]
) -> Optional[str]:

    paths = openapi_details.get(
        "paths",
        {}
    )

    if not isinstance(
        paths,
        dict
    ):
        return None

    endpoint = (
        str(endpoint)
        .rstrip("/")
        or "/"
    )

    if endpoint in paths:

        return endpoint

    for path_template in paths.keys():

        if endpoint_matches_template(
            endpoint,
            path_template
        ):
            return path_template

    return None


def endpoint_matches_template(
    endpoint: str,
    template: str
) -> bool:

    endpoint_parts = (
        endpoint
        .strip("/")
        .split("/")
    )

    template_parts = (
        template
        .strip("/")
        .split("/")
    )

    if len(endpoint_parts) != len(
        template_parts
    ):
        return False

    for actual, expected in zip(
        endpoint_parts,
        template_parts
    ):

        if (
            expected.startswith("{")
            and expected.endswith("}")
        ):
            continue

        if actual != expected:
            return False

    return True


def extract_openapi_operation(
    method: str,
    endpoint: str,
    openapi_details: Dict[str, Any]
) -> Dict[str, Any]:

    method = str(
        method or "GET"
    ).upper()

    path = find_matching_openapi_path(
        endpoint,
        openapi_details
    )

    if not path:
        return {}

    paths = openapi_details.get(
        "paths",
        {}
    )

    path_data = paths.get(
        path,
        {}
    )

    if not isinstance(
        path_data,
        dict
    ):
        return {}

    operation = path_data.get(
        method.lower(),
        {}
    )

    if not isinstance(
        operation,
        dict
    ):
        return {}

    return operation


def extract_request_body_definition(
    request_body: Any
) -> Dict[str, Any]:
    """
    Extracts an OpenAPI requestBody definition when it is
    stored directly inside API.request_body.

    Example input:

    {
        "required": true,
        "content": {
            "application/json": {
                "schema": {
                    ...
                }
            }
        }
    }
    """

    parsed = parse_json(
        request_body
    )

    if not parsed:
        return {}

    if (
        "content" in parsed
        and isinstance(
            parsed.get("content"),
            dict
        )
    ):
        return parsed

    return {}


def get_request_schema(
    method: str,
    endpoint: str,
    openapi_details: Dict[str, Any],
    request_body: Any = None
) -> Dict[str, Any]:
    """
    Finds the OpenAPI JSON schema.

    First checks openapi_details.
    If it is unavailable, checks the stored request_body.
    """

    operation = extract_openapi_operation(
        method,
        endpoint,
        openapi_details
    )

    request_body_definition = operation.get(
        "requestBody",
        {}
    )

    # --------------------------------------------------------
    # If operation requestBody is unavailable, use stored
    # API.request_body.
    # --------------------------------------------------------

    if not isinstance(
        request_body_definition,
        dict
    ):

        request_body_definition = {}

    if not request_body_definition:

        request_body_definition = (
            extract_request_body_definition(
                request_body
            )
        )

    content = request_body_definition.get(
        "content",
        {}
    )

    if not isinstance(
        content,
        dict
    ):
        return {}

    json_content = content.get(
        "application/json",
        {}
    )

    if not isinstance(
        json_content,
        dict
    ):
        return {}

    schema = json_content.get(
        "schema",
        {}
    )

    if not isinstance(
        schema,
        dict
    ):
        return {}

    return schema


# ============================================================
# SUCCESS STATUS CODE
# ============================================================

def get_success_status_code(
    method: str,
    endpoint: str,
    openapi_details: Dict[str, Any]
) -> int:

    operation = extract_openapi_operation(
        method,
        endpoint,
        openapi_details
    )

    responses = operation.get(
        "responses",
        {}
    )

    if isinstance(
        responses,
        dict
    ):

        preferred = [
            "201",
            "200",
            "202",
            "204"
        ]

        for code in preferred:

            if code in responses:

                try:

                    return int(code)

                except (
                    ValueError,
                    TypeError
                ):
                    pass

        for code in responses.keys():

            try:

                numeric_code = int(code)

                if (
                    200
                    <= numeric_code
                    < 300
                ):
                    return numeric_code

            except (
                ValueError,
                TypeError
            ):
                continue

    if str(method).upper() == "POST":

        return 201

    return 200


# ============================================================
# VALID REQUEST DATA
# ============================================================

def build_valid_request_data(
    method: str,
    endpoint: str,
    request_body: Any,
    openapi_details: Dict[str, Any]
) -> Dict[str, Any]:

    method = str(
        method or "GET"
    ).upper()

    # --------------------------------------------------------
    # IMPORTANT:
    # Do NOT use request_body blindly.
    # It may contain an OpenAPI requestBody definition.
    # --------------------------------------------------------

    schema = get_request_schema(
        method,
        endpoint,
        openapi_details,
        request_body
    )

    properties = schema.get(
        "properties",
        {}
    )

    if not isinstance(
        properties,
        dict
    ):
        properties = {}

    result = {}

    # --------------------------------------------------------
    # Generate sample values from OpenAPI schema
    # --------------------------------------------------------

    for name, definition in properties.items():

        if not isinstance(
            definition,
            dict
        ):
            definition = {}

        data_type = definition.get(
            "type"
        )

        data_format = definition.get(
            "format"
        )

        # ----------------------------------------------------
        # Email
        # ----------------------------------------------------

        if data_format == "email":

            result[name] = (
                "test@example.com"
            )

        # ----------------------------------------------------
        # String
        # ----------------------------------------------------

        elif data_type == "string":

            result[name] = (
                "Test User"
            )

        # ----------------------------------------------------
        # Integer
        # ----------------------------------------------------

        elif data_type == "integer":

            minimum = definition.get(
                "minimum"
            )

            maximum = definition.get(
                "maximum"
            )

            if (
                isinstance(minimum, int)
                and isinstance(maximum, int)
            ):

                if minimum <= 25 <= maximum:

                    result[name] = 25

                else:

                    result[name] = minimum

            elif isinstance(
                minimum,
                int
            ):

                result[name] = minimum

            else:

                result[name] = 25

        # ----------------------------------------------------
        # Number
        # ----------------------------------------------------

        elif data_type == "number":

            minimum = definition.get(
                "minimum"
            )

            maximum = definition.get(
                "maximum"
            )

            if (
                isinstance(minimum, (int, float))
                and isinstance(maximum, (int, float))
                and minimum <= 25 <= maximum
            ):

                result[name] = 25

            elif isinstance(
                minimum,
                (int, float)
            ):

                result[name] = minimum

            else:

                result[name] = 25.0

        # ----------------------------------------------------
        # Boolean
        # ----------------------------------------------------

        elif data_type == "boolean":

            result[name] = True

        # ----------------------------------------------------
        # Array
        # ----------------------------------------------------

        elif data_type == "array":

            result[name] = []

        # ----------------------------------------------------
        # Object
        # ----------------------------------------------------

        elif data_type == "object":

            result[name] = {}

    # --------------------------------------------------------
    # Fallback for POST
    # --------------------------------------------------------

    if (
        not result
        and method == "POST"
    ):

        stored_data = normalize_request_data(
            request_body
        )

        # Never use an OpenAPI requestBody definition
        # as actual request data.
        if (
            "content" not in stored_data
            and "required" not in stored_data
        ):
            result = stored_data

    if (
        not result
        and method == "POST"
    ):

        result = {
            "name": "Test User",
            "email": "test@example.com",
            "age": 25
        }

    return result


# ============================================================
# FIND EMAIL FIELD
# ============================================================

def find_email_field(
    method: str,
    endpoint: str,
    openapi_details: Dict[str, Any],
    request_body: Any = None
) -> Optional[str]:

    schema = get_request_schema(
        method,
        endpoint,
        openapi_details,
        request_body
    )

    properties = schema.get(
        "properties",
        {}
    )

    if not isinstance(
        properties,
        dict
    ):
        properties = {}

    for name, definition in properties.items():

        if not isinstance(
            definition,
            dict
        ):
            definition = {}

        if (
            definition.get("format")
            == "email"
        ):
            return name

        if name.lower() == "email":

            return name

    return None


def find_integer_fields(
    method: str,
    endpoint: str,
    openapi_details: Dict[str, Any],
    request_body: Any = None
) -> List[str]:

    schema = get_request_schema(
        method,
        endpoint,
        openapi_details,
        request_body
    )

    properties = schema.get(
        "properties",
        {}
    )

    if not isinstance(
        properties,
        dict
    ):
        properties = {}

    fields = []

    for name, definition in properties.items():

        if not isinstance(
            definition,
            dict
        ):
            definition = {}

        if (
            definition.get("type")
            == "integer"
        ):

            fields.append(name)

    return fields


# ============================================================
# DETERMINISTIC POST CASES
# ============================================================

def build_deterministic_post_cases(
    endpoint: str,
    request_body: Any,
    openapi_details: Dict[str, Any]
) -> List[Dict[str, Any]]:

    valid_data = build_valid_request_data(
        "POST",
        endpoint,
        request_body,
        openapi_details
    )

    success_status = get_success_status_code(
        "POST",
        endpoint,
        openapi_details
    )

    cases = []

    # --------------------------------------------------------
    # 1. VALID USER CREATION
    # --------------------------------------------------------

    cases.append({

        "title":
            "Valid User Creation",

        "method":
            "POST",

        "endpoint":
            endpoint,

        "test_type":
            "Positive",

        "description":
            (
                "Test creating a user with "
                "valid required and optional data."
            ),

        "request_data":
            valid_data,

        "expected_result":
            "User created successfully",

        "expected_status_code":
            success_status
    })

    # --------------------------------------------------------
    # 2. INVALID EMAIL
    # --------------------------------------------------------

    email_field = find_email_field(
        "POST",
        endpoint,
        openapi_details,
        request_body
    )

    if email_field:

        invalid_email_data = dict(
            valid_data
        )

        invalid_email_data[
            email_field
        ] = "invalid-email"

        cases.append({

            "title":
                "Create User with Invalid Email",

            "method":
                "POST",

            "endpoint":
                endpoint,

            "test_type":
                "Negative",

            "description":
                (
                    "Test creating a user with "
                    "an invalid email address."
                ),

            "request_data":
                invalid_email_data,

            "expected_result":
                "Invalid email address",

            "expected_status_code":
                400
        })

    # --------------------------------------------------------
    # 3. NEGATIVE AGE
    # --------------------------------------------------------

    integer_fields = find_integer_fields(
        "POST",
        endpoint,
        openapi_details,
        request_body
    )

    age_field = None

    for field in integer_fields:

        if field.lower() == "age":

            age_field = field

            break

    if age_field:

        negative_age_data = dict(
            valid_data
        )

        negative_age_data[
            age_field
        ] = -1

        cases.append({

            "title":
                "Create User with Negative Age",

            "method":
                "POST",

            "endpoint":
                endpoint,

            "test_type":
                "Negative",

            "description":
                (
                    "Test creating a user with "
                    "a negative age value."
                ),

            "request_data":
                negative_age_data,

            "expected_result":
                "Invalid age value",

            "expected_status_code":
                400
        })

    # --------------------------------------------------------
    # 4. NON-INTEGER AGE
    # --------------------------------------------------------

    if age_field:

        non_integer_age_data = dict(
            valid_data
        )

        non_integer_age_data[
            age_field
        ] = 25.5

        cases.append({

            "title":
                "Create User with Non-Integer Age",

            "method":
                "POST",

            "endpoint":
                endpoint,

            "test_type":
                "Negative",

            "description":
                (
                    "Test creating a user with "
                    "a non-integer age value."
                ),

            "request_data":
                non_integer_age_data,

            "expected_result":
                "Invalid age type",

            "expected_status_code":
                422
        })

    return cases


# ============================================================
# DETERMINISTIC GET CASES
# ============================================================

def build_deterministic_get_cases(
    endpoint: str,
    openapi_details: Dict[str, Any]
) -> List[Dict[str, Any]]:

    path = find_matching_openapi_path(
        endpoint,
        openapi_details
    )

    # --------------------------------------------------------
    # GET /users
    # --------------------------------------------------------

    if path == "/users":

        return [

            {

                "title":
                    "Successful GET Request",

                "method":
                    "GET",

                "endpoint":
                    endpoint,

                "test_type":
                    "Positive",

                "description":
                    "Test successful GET response.",

                "request_data":
                    {},

                "expected_result":
                    "Successful response",

                "expected_status_code":
                    200
            }

        ]

    # --------------------------------------------------------
    # GET /users/{id}
    # --------------------------------------------------------

    if (
        path
        and "{"
        in path
        and "}"
        in path
    ):

        return [

            {

                "title":
                    "Valid User Retrieval",

                "method":
                    "GET",

                "endpoint":
                    make_concrete_endpoint(
                        path,
                        "1"
                    ),

                "test_type":
                    "Positive",

                "description":
                    "Retrieve an existing user.",

                "request_data":
                    {},

                "expected_result":
                    "User found",

                "expected_status_code":
                    200
            },

            {

                "title":
                    "Invalid User ID Type",

                "method":
                    "GET",

                "endpoint":
                    make_concrete_endpoint(
                        path,
                        "abc"
                    ),

                "test_type":
                    "Negative",

                "description":
                    "Test a non-integer user ID.",

                "request_data":
                    {},

                "expected_result":
                    "Validation error",

                "expected_status_code":
                    422
            },

            {

                "title":
                    "Non-Existing User",

                "method":
                    "GET",

                "endpoint":
                    make_concrete_endpoint(
                        path,
                        "999999"
                    ),

                "test_type":
                    "Negative",

                "description":
                    (
                        "Test a numeric user ID "
                        "that does not exist."
                    ),

                "request_data":
                    {},

                "expected_result":
                    "User not found",

                "expected_status_code":
                    404
            }

        ]

    # --------------------------------------------------------
    # Other GET endpoint
    # --------------------------------------------------------

    return [

        {

            "title":
                "Successful GET Request",

            "method":
                "GET",

            "endpoint":
                endpoint,

            "test_type":
                "Positive",

            "description":
                "Test successful GET response.",

            "request_data":
                {},

            "expected_result":
                "Successful response",

            "expected_status_code":
                200
        }

    ]


def make_concrete_endpoint(
    path_template: str,
    value: str
) -> str:

    return re.sub(
        r"\{[^}]+\}",
        str(value),
        path_template
    )


# ============================================================
# OPTIONAL OLLAMA ANALYSIS
# ============================================================

def call_ollama(
    method: str,
    endpoint: str,
    request_body: Any,
    openapi_details: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Ollama is used only for analysis and suggestions.

    It does NOT execute API requests.

    Its generated cases are NOT directly added to the
    executable test list.
    """

    prompt = f"""
Analyze this REST API and suggest additional test ideas.

Method:
{method}

Endpoint:
{endpoint}

Request body:
{json.dumps(
    normalize_request_data(
        request_body
    ),
    indent=2
)}

OpenAPI:
{json.dumps(
    openapi_details,
    indent=2
)}

Return JSON only.

Do not execute requests.
Do not invent endpoints.
Do not invent HTTP methods.
"""

    try:

        response = requests.post(
            OLLAMA_URL,
            json={
                "model":
                    OLLAMA_MODEL,

                "prompt":
                    prompt,

                "stream":
                    False
            },
            timeout=OLLAMA_TIMEOUT
        )

        response.raise_for_status()

        response_data = response.json()

        ai_text = response_data.get(
            "response",
            ""
        )

        parsed = clean_json_response(
            ai_text
        )

        if isinstance(
            parsed,
            dict
        ):

            parsed = parsed.get(
                "test_cases",
                []
            )

        if isinstance(
            parsed,
            list
        ):

            return [

                item

                for item in parsed

                if isinstance(
                    item,
                    dict
                )

            ]

    except Exception as exc:

        print(
            "Ollama analysis unavailable."
        )

        print(
            f"Ollama error: {exc}"
        )

    return []


# ============================================================
# TEST CASE VALIDATION
# ============================================================

def validate_test_case(
    case: Any
) -> bool:

    if not isinstance(
        case,
        dict
    ):
        return False

    required_fields = [

        "title",

        "method",

        "endpoint",

        "test_type",

        "description",

        "request_data",

        "expected_result",

        "expected_status_code"

    ]

    for field in required_fields:

        if field not in case:

            return False

    method = str(
        case.get(
            "method",
            ""
        )
    ).upper()

    if method not in {

        "GET",

        "POST",

        "PUT",

        "PATCH",

        "DELETE"

    }:

        return False

    try:

        status_code = int(
            case.get(
                "expected_status_code"
            )
        )

    except (
        ValueError,
        TypeError
    ):

        return False

    if not (
        100
        <= status_code
        <= 599
    ):

        return False

    return True


# ============================================================
# CORRECT TEST CASE
# ============================================================

def correct_test_case(
    case: Dict[str, Any],
    method: str,
    endpoint: str,
    request_body: Any,
    openapi_details: Dict[str, Any]
) -> Dict[str, Any]:

    corrected = dict(
        case
    )

    method = str(
        method or "GET"
    ).upper()

    corrected["method"] = method

    title = str(
        corrected.get(
            "title",
            ""
        )
    ).strip()

    title_lower = title.lower()

    request_data = normalize_request_data(
        corrected.get(
            "request_data"
        )
    )

    # --------------------------------------------------------
    # POST
    # --------------------------------------------------------

    if method == "POST":

        if (
            "valid user creation"
            in title_lower
        ):

            request_data = (
                build_valid_request_data(
                    "POST",
                    endpoint,
                    request_body,
                    openapi_details
                )
            )

            corrected[
                "expected_status_code"
            ] = get_success_status_code(
                "POST",
                endpoint,
                openapi_details
            )

        elif (
            "invalid email"
            in title_lower
        ):

            valid_data = (
                build_valid_request_data(
                    "POST",
                    endpoint,
                    request_body,
                    openapi_details
                )
            )

            email_field = find_email_field(
                "POST",
                endpoint,
                openapi_details,
                request_body
            )

            if email_field:

                request_data = dict(
                    valid_data
                )

                request_data[
                    email_field
                ] = "invalid-email"

            corrected[
                "expected_status_code"
            ] = 400

        elif (
            "negative age"
            in title_lower
        ):

            valid_data = (
                build_valid_request_data(
                    "POST",
                    endpoint,
                    request_body,
                    openapi_details
                )
            )

            request_data = dict(
                valid_data
            )

            integer_fields = (
                find_integer_fields(
                    "POST",
                    endpoint,
                    openapi_details,
                    request_body
                )
            )

            for field in integer_fields:

                if field.lower() == "age":

                    request_data[
                        field
                    ] = -1

                    break

            corrected[
                "expected_status_code"
            ] = 400

        elif (
            "non-integer age"
            in title_lower
            or "non integer age"
            in title_lower
        ):

            valid_data = (
                build_valid_request_data(
                    "POST",
                    endpoint,
                    request_body,
                    openapi_details
                )
            )

            request_data = dict(
                valid_data
            )

            integer_fields = (
                find_integer_fields(
                    "POST",
                    endpoint,
                    openapi_details,
                    request_body
                )
            )

            for field in integer_fields:

                if field.lower() == "age":

                    request_data[
                        field
                    ] = 25.5

                    break

            corrected[
                "expected_status_code"
            ] = 422

        elif (
            "empty request body"
            in title_lower
            or "empty body"
            in title_lower
        ):

            request_data = {}

            corrected[
                "expected_status_code"
            ] = 422

        else:

            request_data = (
                build_valid_request_data(
                    "POST",
                    endpoint,
                    request_body,
                    openapi_details
                )
            )

            corrected[
                "expected_status_code"
            ] = get_success_status_code(
                "POST",
                endpoint,
                openapi_details
            )

    # --------------------------------------------------------
    # GET
    # --------------------------------------------------------

    elif method == "GET":

        if (
            "valid user retrieval"
            in title_lower
        ):

            corrected[
                "expected_status_code"
            ] = 200

        elif (
            "successful get"
            in title_lower
        ):

            corrected[
                "expected_status_code"
            ] = 200

        elif (
            "invalid user id type"
            in title_lower
            or "invalid id type"
            in title_lower
            or "non-numeric"
            in title_lower
            or "non numeric"
            in title_lower
        ):

            corrected[
                "expected_status_code"
            ] = 422

        elif (
            "non-existing"
            in title_lower
            or "non existing"
            in title_lower
            or "not found"
            in title_lower
        ):

            corrected[
                "expected_status_code"
            ] = 404

        else:

            corrected[
                "expected_status_code"
            ] = 200

    # --------------------------------------------------------
    # OTHER METHODS
    # --------------------------------------------------------

    else:

        corrected[
            "expected_status_code"
        ] = get_success_status_code(
            method,
            endpoint,
            openapi_details
        )

    corrected[
        "request_data"
    ] = request_data

    corrected[
        "test_type"
    ] = normalize_test_type(
        corrected.get(
            "test_type"
        )
    )

    return corrected


# ============================================================
# DUPLICATES
# ============================================================

def test_case_signature(
    case: Dict[str, Any]
) -> tuple:

    return (

        str(
            case.get(
                "method",
                ""
            )
        ).upper(),

        str(
            case.get(
                "endpoint",
                ""
            )
        ),

        safe_json_string(
            case.get(
                "request_data",
                {}
            )
        ),

        int(
            case.get(
                "expected_status_code",
                0
            )
        )

    )


def remove_duplicate_test_cases(
    cases: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:

    unique = []

    seen = set()

    for case in cases:

        signature = test_case_signature(
            case
        )

        if signature in seen:

            continue

        seen.add(
            signature
        )

        unique.append(
            case
        )

    return unique


# ============================================================
# MAIN GENERATOR
# ============================================================

def generate_ai_test_cases(
    method: str,
    endpoint: str,
    request_body: Any = "",
    openapi_details: Any = None
) -> List[Dict[str, Any]]:
    """
    Generate API test cases.

    IMPORTANT:

    This function DOES NOT execute API requests.

    API execution is handled by app/ai_test.py.
    """

    method = str(
        method or "GET"
    ).upper()

    endpoint = str(
        endpoint or "/"
    ).strip()

    openapi_details = (
        parse_openapi_details(
            openapi_details
        )
    )

    # ========================================================
    # DETERMINISTIC CASES
    # ========================================================

    if method == "POST":

        deterministic_cases = (
            build_deterministic_post_cases(
                endpoint,
                request_body,
                openapi_details
            )
        )

    elif method == "GET":

        deterministic_cases = (
            build_deterministic_get_cases(
                endpoint,
                openapi_details
            )
        )

    else:

        deterministic_cases = [

            {

                "title":
                    f"Successful {method} Request",

                "method":
                    method,

                "endpoint":
                    endpoint,

                "test_type":
                    "Positive",

                "description":
                    (
                        f"Test successful "
                        f"{method} request."
                    ),

                "request_data":
                    build_valid_request_data(
                        method,
                        endpoint,
                        request_body,
                        openapi_details
                    ),

                "expected_result":
                    "Successful response",

                "expected_status_code":
                    get_success_status_code(
                        method,
                        endpoint,
                        openapi_details
                    )

            }

        ]

    # ========================================================
    # CORRECT DETERMINISTIC CASES
    # ========================================================

    final_cases = []

    for case in deterministic_cases:

        corrected = correct_test_case(
            case,
            method,
            endpoint,
            request_body,
            openapi_details
        )

        if validate_test_case(
            corrected
        ):

            final_cases.append(
                corrected
            )

    # ========================================================
    # OPTIONAL OLLAMA ANALYSIS
    # ========================================================

    try:

        call_ollama(
            method,
            endpoint,
            request_body,
            openapi_details
        )

    except Exception:

        pass

    # ========================================================
    # REMOVE DUPLICATES
    # ========================================================

    final_cases = (
        remove_duplicate_test_cases(
            final_cases
        )
    )

    # ========================================================
    # FINAL SAFETY CHECK
    # ========================================================

    if not final_cases:

        raise RuntimeError(
            "No valid API test cases could be generated."
        )

    return final_cases[:12]