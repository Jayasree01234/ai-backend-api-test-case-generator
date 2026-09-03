import json
import re
import requests


OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"


# ============================================================
# CLEAN AI RESPONSE
# ============================================================

def clean_json_response(response_text):
    """
    Clean AI response and extract JSON array.
    """

    if not response_text:
        return ""

    response_text = response_text.strip()

    # Remove markdown code blocks
    response_text = re.sub(
        r"```json",
        "",
        response_text,
        flags=re.IGNORECASE
    )

    response_text = response_text.replace(
        "```",
        ""
    ).strip()

    # Find JSON array
    start = response_text.find("[")
    end = response_text.rfind("]")

    if start != -1 and end != -1:
        response_text = response_text[start:end + 1]

    return response_text


# ============================================================
# GENERATE AI TEST CASES
# ============================================================

def generate_ai_test_cases(
    method,
    endpoint,
    request_body="",
    openapi_details=None
):
    """
    Generate API test cases using Ollama AI.
    """

    method = method.upper()

    if openapi_details is None:
        openapi_details = {}

    # Convert OpenAPI details safely
    try:
        openapi_text = json.dumps(
            openapi_details,
            indent=2
        )
    except Exception:
        openapi_text = "{}"

    # ========================================================
    # AI PROMPT
    # ========================================================

    prompt = f"""
You are an expert API QA engineer.

Generate realistic, unique, and technically correct API test cases.

API INFORMATION:

HTTP Method: {method}

Endpoint: {endpoint}

Request Body:
{request_body}

OpenAPI Details:
{openapi_text}


IMPORTANT RULES:

1. Generate ONLY relevant test cases for this API.

2. Never generate duplicate test cases.

3. Never repeat the same test case title.

4. GET and DELETE APIs usually do NOT use JSON request bodies.

For GET or DELETE APIs:
DO NOT generate:
- Invalid JSON
- Missing JSON
- Invalid JSON format
- Empty request body
- Missing request body

Unless the OpenAPI specification explicitly defines a request body.

5. For GET APIs focus on:
- Valid request
- Valid path parameters
- Invalid path parameters
- Query parameter validation
- Missing required parameters
- Boundary values
- Non-existing resources
- Unauthorized access

6. For POST APIs focus on:
- Valid request
- Missing required fields
- Invalid field formats
- Empty request body
- Invalid JSON
- Boundary values
- Validation errors
- Duplicate data when relevant
- Unauthorized access
- Security validation

7. For PUT and PATCH APIs focus on:
- Valid update
- Invalid update data
- Missing required fields
- Invalid formats
- Boundary values
- Non-existing resource
- Unauthorized access

8. If the endpoint contains a path parameter such as:

/users/{{id}}

Generate tests such as:
- Valid ID
- Invalid ID format
- Non-existing ID
- Minimum boundary ID
- Maximum boundary ID

9. Security test cases must be meaningful.

Examples:
- Unauthorized request
- Invalid authentication token
- SQL injection attempt
- Malicious input validation

10. Do NOT generate meaningless test cases.

11. Generate between 6 and 10 unique test cases.


IMPORTANT JSON RULE:

Return ONLY valid JSON.

Do not add explanations.
Do not add markdown.
Do not use ```json.
Do not use text before or after JSON.

All JSON values MUST be inside double quotes.


Return exactly this structure:

[
  {{
    "title": "Valid request",
    "method": "{method}",
    "endpoint": "{endpoint}",
    "test_type": "Positive",
    "description": "Verify that a valid request is accepted.",
    "request_data": "",
    "expected_result": "API should return a successful response."
  }}
]

Allowed test_type values:

"Positive"
"Negative"
"Boundary"
"Validation"
"Security"
"""

    try:

        # ====================================================
        # CALL OLLAMA
        # ====================================================

        response = requests.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False
            },
            timeout=180
        )

        response.raise_for_status()

        result = response.json()

        ai_response = result.get(
            "response",
            ""
        )

        print("\n================ AI RESPONSE ================\n")
        print(ai_response)
        print("\n=============================================\n")

        # ====================================================
        # CLEAN RESPONSE
        # ====================================================

        cleaned_response = clean_json_response(
            ai_response
        )

        # ====================================================
        # PARSE JSON SAFELY
        # ====================================================

        try:

            test_cases = json.loads(
                cleaned_response
            )

        except json.JSONDecodeError as e:

            print(
                "Invalid AI JSON Response:",
                str(e)
            )

            print(
                "Cleaned Response:"
            )

            print(
                cleaned_response
            )

            # Do not crash the entire application
            return []

        # ====================================================
        # VALIDATE RESPONSE
        # ====================================================

        if not isinstance(
            test_cases,
            list
        ):
            print(
                "AI response is not a list."
            )

            return []

        # ====================================================
        # REMOVE DUPLICATES
        # ====================================================

        unique_test_cases = []

        seen_titles = set()

        for test_case in test_cases:

            if not isinstance(
                test_case,
                dict
            ):
                continue

            title = (
                test_case.get(
                    "title",
                    ""
                )
                .strip()
            )

            if not title:
                continue

            normalized_title = (
                title.lower()
            )

            # Skip duplicate titles
            if normalized_title in seen_titles:
                continue

            seen_titles.add(
                normalized_title
            )

            # Force correct API information
            test_case["method"] = method

            test_case["endpoint"] = endpoint

            # Ensure test_type exists
            if not test_case.get(
                "test_type"
            ):
                test_case[
                    "test_type"
                ] = "Positive"

            # Ensure required fields exist
            test_case.setdefault(
                "description",
                ""
            )

            test_case.setdefault(
                "request_data",
                ""
            )

            test_case.setdefault(
                "expected_result",
                ""
            )

            unique_test_cases.append(
                test_case
            )

        # ====================================================
        # FILTER INVALID TESTS FOR GET / DELETE
        # ====================================================

        if method in [
            "GET",
            "DELETE"
        ]:

            invalid_keywords = [
                "invalid json",
                "missing json",
                "json format",
                "empty request body",
                "missing request body"
            ]

            filtered_test_cases = []

            for test_case in unique_test_cases:

                title = test_case.get(
                    "title",
                    ""
                ).lower()

                description = test_case.get(
                    "description",
                    ""
                ).lower()

                request_data = str(
                    test_case.get(
                        "request_data",
                        ""
                    )
                ).lower()

                combined_text = (
                    title
                    + " "
                    + description
                    + " "
                    + request_data
                )

                # Remove irrelevant JSON tests
                if any(
                    keyword in combined_text
                    for keyword in invalid_keywords
                ):
                    continue

                filtered_test_cases.append(
                    test_case
                )

            unique_test_cases = (
                filtered_test_cases
            )

        # ====================================================
        # LIMIT TEST CASES
        # ====================================================

        return unique_test_cases[:10]

    except requests.exceptions.ConnectionError:

        print(
            "Ollama is not running or cannot be reached."
        )

        return []

    except requests.exceptions.Timeout:

        print(
            "Ollama request timed out."
        )

        return []

    except Exception as e:

        print(
            "AI Generation Error:",
            str(e)
        )

        # Prevent 500 error
        return []