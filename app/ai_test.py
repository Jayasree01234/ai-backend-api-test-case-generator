import json
import re
import requests

from app.ai.generator import generate_ai_test_cases


# ============================================================
# CONFIGURATION
# ============================================================

BASE_URL = "http://127.0.0.1:8000"
REQUEST_TIMEOUT = 15


# ============================================================
# SAFE INTEGER
# ============================================================

def safe_int(
    value,
    default=200
):
    """
    Converts a value into a valid HTTP status code.
    """

    try:

        value = int(value)

        if 100 <= value <= 599:
            return value

    except (TypeError, ValueError):
        pass

    return default


# ============================================================
# PARSE REQUEST DATA
# ============================================================

def parse_request_data(value):
    """
    Converts request_data into Python data.
    """

    if value is None:
        return {}

    if isinstance(
        value,
        (dict, list)
    ):
        return value

    value = str(
        value
    ).strip()

    if not value:
        return {}

    try:

        return json.loads(
            value
        )

    except json.JSONDecodeError:

        return {}


# ============================================================
# ANALYZE API
# ============================================================

def analyze_api_structure(api):
    """
    Reads API information from the SQLAlchemy API object.
    """

    method = str(
        getattr(
            api,
            "method",
            ""
        )
    ).upper().strip()

    endpoint = str(
        getattr(
            api,
            "endpoint",
            ""
        )
    ).strip()

    request_body = getattr(
        api,
        "request_body",
        ""
    )

    openapi_details = getattr(
        api,
        "openapi_details",
        None
    )

    if request_body is None:
        request_body = ""

    if not openapi_details:
        openapi_details = {}

    if isinstance(
        openapi_details,
        str
    ):

        try:

            openapi_details = json.loads(
                openapi_details
            )

        except json.JSONDecodeError:

            openapi_details = {}

    return {
        "method": method,
        "endpoint": endpoint,
        "request_body": request_body,
        "openapi_details": openapi_details
    }


# ============================================================
# FIND PATH PARAMETERS
# ============================================================

def find_path_parameters(endpoint):
    """
    Finds path parameters such as {id} or {user_id}.
    """

    if not endpoint:
        return []

    return re.findall(
        r"\{([^{}]+)\}",
        endpoint
    )


# ============================================================
# BUILD CONCRETE ENDPOINT
# ============================================================

def build_concrete_endpoint(
    endpoint,
    request_data=None
):
    """
    Replaces path parameters with concrete values.
    """

    endpoint = str(
        endpoint
    )

    request_data = request_data or {}

    parameters = find_path_parameters(
        endpoint
    )

    for parameter in parameters:

        value = None

        if isinstance(
            request_data,
            dict
        ):

            value = request_data.get(
                parameter
            )

        if value is None:

            parameter_lower = parameter.lower()

            if parameter_lower in {
                "id",
                "user_id",
                "userid",
                "project_id",
                "api_id"
            }:

                value = 1

            else:

                value = "1"

        endpoint = endpoint.replace(
            "{" + parameter + "}",
            str(value)
        )

    return endpoint


# ============================================================
# BUILD FULL URL
# ============================================================

def build_url(endpoint):
    """
    Converts an endpoint into a complete URL.
    """

    endpoint = str(
        endpoint
    ).strip()

    if endpoint.startswith(
        "http://"
    ):

        return endpoint

    if endpoint.startswith(
        "https://"
    ):

        return endpoint

    if not endpoint.startswith(
        "/"
    ):

        endpoint = "/" + endpoint

    return (
        BASE_URL.rstrip("/")
        + endpoint
    )


# ============================================================
# DETERMINE EXPECTED STATUS CODE
# ============================================================

def determine_expected_status_code(
    test_case,
    method
):
    """
    Determines the expected HTTP status code.
    """

    if "expected_status_code" in test_case:

        status_code = safe_int(
            test_case.get(
                "expected_status_code"
            ),
            0
        )

        if 100 <= status_code <= 599:

            return status_code


    test_type = str(
        test_case.get(
            "test_type",
            ""
        )
    ).lower()

    title = str(
        test_case.get(
            "title",
            ""
        )
    ).lower()


    # --------------------------------------------------------
    # Validation / negative cases
    # --------------------------------------------------------

    if (
        "validation" in test_type
        or "negative" in test_type
        or "invalid" in title
        or "missing" in title
    ):

        return 422


    # --------------------------------------------------------
    # Security cases
    # --------------------------------------------------------

    if "security" in test_type:

        return 401


    # --------------------------------------------------------
    # Successful cases
    # --------------------------------------------------------

    method = str(
        method
    ).upper()

    if method == "POST":

        return 201

    if method == "DELETE":

        return 204

    return 200


# ============================================================
# NORMALIZE TEST CASE
# ============================================================

def normalize_test_case(
    test_case,
    api_info
):
    """
    Converts one AI-generated test case into the format
    required by the execution pipeline.
    """

    method = str(
        test_case.get(
            "method",
            api_info["method"]
        )
    ).upper().strip()

    endpoint = str(
        test_case.get(
            "endpoint",
            api_info["endpoint"]
        )
    ).strip()

    request_data = parse_request_data(
        test_case.get(
            "request_data",
            "{}"
        )
    )

    expected_status_code = (
        determine_expected_status_code(
            test_case,
            method
        )
    )

    endpoint = build_concrete_endpoint(
        endpoint,
        request_data
    )

    return {
        "title": str(
            test_case.get(
                "title",
                "Generated API Test"
            )
        ).strip(),

        "method": method,

        "endpoint": endpoint,

        "test_type": str(
            test_case.get(
                "test_type",
                "Functional"
            )
        ).strip(),

        "description": str(
            test_case.get(
                "description",
                "Verify API behavior."
            )
        ).strip(),

        "request_data": json.dumps(
            request_data,
            separators=(",", ":")
        ),

        "expected_result": str(
            test_case.get(
                "expected_result",
                "API should return the expected response."
            )
        ).strip(),

        "expected_status_code": expected_status_code
    }


# ============================================================
# GENERATE EXECUTABLE PYTHON TEST CODE
# ============================================================

def generate_test_code(
    method,
    endpoint,
    request_data,
    expected_status_code
):
    """
    Generates executable Python code for one API test.
    """

    method = str(
        method
    ).upper()

    endpoint = build_concrete_endpoint(
        endpoint,
        request_data
    )

    url = build_url(
        endpoint
    )

    request_json = json.dumps(
        request_data or {},
        indent=4
    )


    # ========================================================
    # GET
    # ========================================================

    if method == "GET":

        return f'''import requests


def test_api():
    url = "{url}"

    response = requests.get(
        url,
        timeout=15
    )

    assert response.status_code == {expected_status_code}
'''


    # ========================================================
    # POST
    # ========================================================

    if method == "POST":

        return f'''import requests


def test_api():
    url = "{url}"

    response = requests.post(
        url,
        json={request_json},
        timeout=15
    )

    assert response.status_code == {expected_status_code}
'''


    # ========================================================
    # PUT
    # ========================================================

    if method == "PUT":

        return f'''import requests


def test_api():
    url = "{url}"

    response = requests.put(
        url,
        json={request_json},
        timeout=15
    )

    assert response.status_code == {expected_status_code}
'''


    # ========================================================
    # PATCH
    # ========================================================

    if method == "PATCH":

        return f'''import requests


def test_api():
    url = "{url}"

    response = requests.patch(
        url,
        json={request_json},
        timeout=15
    )

    assert response.status_code == {expected_status_code}
'''


    # ========================================================
    # DELETE
    # ========================================================

    if method == "DELETE":

        return f'''import requests


def test_api():
    url = "{url}"

    response = requests.delete(
        url,
        timeout=15
    )

    assert response.status_code == {expected_status_code}
'''


    # ========================================================
    # OTHER HTTP METHODS
    # ========================================================

    return f'''import requests


def test_api():
    url = "{url}"

    response = requests.request(
        "{method}",
        url,
        json={request_json},
        timeout=15
    )

    assert response.status_code == {expected_status_code}
'''


# ============================================================
# EXECUTE TEST CASE
# ============================================================

def execute_test_case(
    method,
    endpoint,
    request_data,
    expected_status_code
):
    """
    Executes one generated test case against the real API.
    """

    method = str(
        method
    ).upper()

    endpoint = build_concrete_endpoint(
        endpoint,
        request_data
    )

    url = build_url(
        endpoint
    )

    try:

        if method == "GET":

            response = requests.get(
                url,
                timeout=REQUEST_TIMEOUT
            )

        elif method == "POST":

            response = requests.post(
                url,
                json=request_data or {},
                timeout=REQUEST_TIMEOUT
            )

        elif method == "PUT":

            response = requests.put(
                url,
                json=request_data or {},
                timeout=REQUEST_TIMEOUT
            )

        elif method == "PATCH":

            response = requests.patch(
                url,
                json=request_data or {},
                timeout=REQUEST_TIMEOUT
            )

        elif method == "DELETE":

            response = requests.delete(
                url,
                timeout=REQUEST_TIMEOUT
            )

        else:

            response = requests.request(
                method,
                url,
                json=request_data or {},
                timeout=REQUEST_TIMEOUT
            )


        # ====================================================
        # ACTUAL RESULT
        # ====================================================

        actual_status_code = (
            response.status_code
        )

        actual_result = (
            f"HTTP {actual_status_code}: "
            f"{response.text[:1000]}"
        )


        # ====================================================
        # PASS / FAIL
        # ====================================================

        if (
            actual_status_code
            == expected_status_code
        ):

            execution_status = "PASS"

        else:

            execution_status = "FAIL"


        return {
            "actual_result": actual_result,
            "execution_status": execution_status,
            "actual_status_code": actual_status_code
        }


    except requests.RequestException as exc:

        return {
            "actual_result": (
                f"Request failed: {str(exc)}"
            ),
            "execution_status": "FAIL",
            "actual_status_code": None
        }


# ============================================================
# MAIN AI TEST PIPELINE
# ============================================================

def generate_and_execute_tests(api):
    """
    MAIN AI TEST PIPELINE.

    This function:

    1. Reads the API.
    2. Calls generator.py.
    3. Receives AI-generated test cases.
    4. Normalizes test cases.
    5. Creates executable Python code.
    6. Executes each API test.
    7. Determines PASS / FAIL.
    8. Returns final results.

    This is the function that the backend route should call.
    """

    # ========================================================
    # STEP 1: ANALYZE API
    # ========================================================

    api_info = analyze_api_structure(
        api
    )


    # ========================================================
    # STEP 2: OLLAMA GENERATION
    # ========================================================

    generated_test_cases = (
        generate_ai_test_cases(
            method=api_info["method"],
            endpoint=api_info["endpoint"],
            request_body=api_info["request_body"],
            openapi_details=api_info["openapi_details"]
        )
    )


    # ========================================================
    # STEP 3: EXECUTE EACH TEST CASE
    # ========================================================

    final_cases = []

    for generated_case in generated_test_cases:

        test_case = normalize_test_case(
            generated_case,
            api_info
        )

        request_data = parse_request_data(
            test_case["request_data"]
        )

        expected_status_code = safe_int(
            test_case["expected_status_code"],
            200
        )


        # ====================================================
        # CONCRETE ENDPOINT
        # ====================================================

        executable_endpoint = (
            build_concrete_endpoint(
                test_case["endpoint"],
                request_data
            )
        )

        test_case["endpoint"] = (
            executable_endpoint
        )


        # ====================================================
        # CREATE EXECUTABLE CODE
        # ====================================================

        test_case["test_code"] = (
            generate_test_code(
                method=test_case["method"],
                endpoint=executable_endpoint,
                request_data=request_data,
                expected_status_code=expected_status_code
            )
        )


        # ====================================================
        # EXECUTE API
        # ====================================================

        execution = execute_test_case(
            method=test_case["method"],
            endpoint=executable_endpoint,
            request_data=request_data,
            expected_status_code=expected_status_code
        )


        # ====================================================
        # SAVE RESULT
        # ====================================================

        test_case["actual_result"] = (
            execution["actual_result"]
        )

        test_case["execution_status"] = (
            execution["execution_status"]
        )


        final_cases.append(
            test_case
        )


    # ========================================================
    # RETURN FINAL RESULTS
    # ========================================================

    return final_cases


# ============================================================
# BACKEND-FRIENDLY FUNCTION
# ============================================================

def generate_ai_test_cases_for_api(api):
    """
    Backend entry point.

    Accepts ONE API object and runs the complete
    AI generation + execution pipeline.
    """

    return generate_and_execute_tests(
        api
    )