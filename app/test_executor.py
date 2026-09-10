import json
import re
import requests


DEFAULT_BASE_URL = "http://127.0.0.1:8000"


def extract_expected_status(expected_result: str):
    if not expected_result:
        return None

    text = expected_result.upper()

    match = re.search(r"\b([1-5][0-9]{2})\b", text)

    if match:
        return int(match.group(1))

    if "BAD REQUEST" in text:
        return 400

    if "UNAUTHORIZED" in text:
        return 401

    if "FORBIDDEN" in text:
        return 403

    if "NOT FOUND" in text:
        return 404

    if "SUCCESS" in text or "OK" in text:
        return 200

    return None


def prepare_request_data(request_data):
    if not request_data:
        return None

    try:
        return json.loads(request_data)

    except (json.JSONDecodeError, TypeError):
        return None


def generate_test_code(test_case):
    method = test_case.method.lower()
    endpoint = test_case.endpoint

    expected_status = extract_expected_status(
        test_case.expected_result
    )

    function_name = re.sub(
        r"[^a-zA-Z0-9_]",
        "_",
        test_case.title.lower()
    )

    request_data = test_case.request_data or "{}"

    if method in ["post", "put", "patch"]:
        return f'''import requests

BASE_URL = "{DEFAULT_BASE_URL}"


def test_{function_name}():
    response = requests.{method}(
        f"{{BASE_URL}}{endpoint}",
        json={request_data}
    )

    assert response.status_code == {expected_status or 200}
'''

    return f'''import requests

BASE_URL = "{DEFAULT_BASE_URL}"


def test_{function_name}():
    response = requests.{method}(
        f"{{BASE_URL}}{endpoint}"
    )

    assert response.status_code == {expected_status or 200}
'''


def execute_test_case(test_case):
    method = test_case.method.upper()
    endpoint = test_case.endpoint

    url = f"{DEFAULT_BASE_URL}{endpoint}"

    request_data = prepare_request_data(
        test_case.request_data
    )

    expected_status = extract_expected_status(
        test_case.expected_result
    )

    try:

        if method in ["POST", "PUT", "PATCH"]:
            response = requests.request(
                method,
                url,
                json=request_data,
                timeout=10
            )
        else:
            response = requests.request(
                method,
                url,
                timeout=10
            )

        actual_response = {
            "status_code": response.status_code
        }

        try:
            actual_response["response"] = response.json()
        except ValueError:
            actual_response["response"] = response.text

        if expected_status is None:
            success = response.status_code < 400
        else:
            success = response.status_code == expected_status

        return {
            "actual_result": json.dumps(
                actual_response,
                indent=2
            ),
            "execution_status": "PASS" if success else "FAIL"
        }

    except requests.exceptions.RequestException as exc:
        return {
            "actual_result": f"Execution Error: {str(exc)}",
            "execution_status": "FAIL"
        }