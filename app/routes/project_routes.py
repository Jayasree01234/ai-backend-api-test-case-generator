from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json
import os

from app import models, schemas
from app.database import get_db
from app.auth import get_current_user
from app.ai_test import generate_ai_test_cases_for_api


router = APIRouter(
    prefix="/projects",
    tags=["Projects"]
)


# ============================================================
# GET USER PROJECT
# ============================================================

def get_user_project(
    project_id: int,
    user_id: int,
    db: Session
):
    project = (
        db.query(models.Project)
        .filter(
            models.Project.id == project_id,
            models.Project.owner_id == user_id
        )
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    return project


# ============================================================
# PARSE REQUEST DATA FOR GENERATED PYTEST FILE
# ============================================================

def parse_request_data_for_file(value):
    """
    Converts request_data into a Python object that can
    safely be written into the generated pytest file.
    """

    if value is None:
        return {}

    if isinstance(value, (dict, list)):
        return value

    if isinstance(value, str):
        value = value.strip()

        if not value:
            return {}

        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return {}

    return {}


# ============================================================
# WRITE GENERATED TESTS TO FILE
# ============================================================

def write_generated_tests_to_file(
    project_id: int,
    test_cases: list
):
    """
    Creates a clean pytest file containing all generated
    executable test cases.

    The generated file is:
        tests/test_generated_cases.py
    """

    tests_directory = os.path.join(
        os.getcwd(),
        "tests"
    )

    os.makedirs(
        tests_directory,
        exist_ok=True
    )

    file_path = os.path.join(
        tests_directory,
        "test_generated_cases.py"
    )

    with open(
        file_path,
        "w",
        encoding="utf-8"
    ) as file:

        file.write(
            '"""Automatically generated API test cases."""\n\n'
        )

        file.write(
            "import requests\n\n"
        )

        file.write(
            'BASE_URL = "http://127.0.0.1:8000"\n'
        )

        file.write(
            "REQUEST_TIMEOUT = 15\n\n\n"
        )

        # --------------------------------------------------------
        # Create one pytest function for each test case
        # --------------------------------------------------------

        for index, test_case in enumerate(
            test_cases,
            start=1
        ):

            title = str(
                test_case.get(
                    "title",
                    f"Generated Test Case {index}"
                )
            ).strip()

            method = str(
                test_case.get(
                    "method",
                    "GET"
                )
            ).upper().strip()

            endpoint = str(
                test_case.get(
                    "endpoint",
                    "/"
                )
            ).strip()

            if not endpoint.startswith(
                "/"
            ) and not endpoint.startswith(
                "http://"
            ) and not endpoint.startswith(
                "https://"
            ):
                endpoint = "/" + endpoint

            request_data = (
                parse_request_data_for_file(
                    test_case.get(
                        "request_data",
                        {}
                    )
                )
            )

            expected_status_code = test_case.get(
                "expected_status_code"
            )

            # ----------------------------------------------------
            # Unique pytest function name
            # ----------------------------------------------------

            function_name = (
                f"test_generated_case_{index}"
            )

            # ----------------------------------------------------
            # Write test function
            # ----------------------------------------------------

            file.write(
                f"def {function_name}():\n"
            )

            file.write(
                f'    """{title}"""\n'
            )

            # ----------------------------------------------------
            # URL
            # ----------------------------------------------------

            if (
                endpoint.startswith("http://")
                or endpoint.startswith("https://")
            ):
                file.write(
                    f'    url = {endpoint!r}\n'
                )
            else:
                file.write(
                    f'    url = BASE_URL + {endpoint!r}\n'
                )

            # ----------------------------------------------------
            # GET
            # ----------------------------------------------------

            if method == "GET":

                file.write(
                    "    response = requests.get(\n"
                    "        url,\n"
                    "        timeout=REQUEST_TIMEOUT\n"
                    "    )\n"
                )

            # ----------------------------------------------------
            # POST
            # ----------------------------------------------------

            elif method == "POST":

                request_json = json.dumps(
                    request_data,
                    indent=4
                )

                file.write(
                    "    response = requests.post(\n"
                    "        url,\n"
                    f"        json={request_json},\n"
                    "        timeout=REQUEST_TIMEOUT\n"
                    "    )\n"
                )

            # ----------------------------------------------------
            # PUT
            # ----------------------------------------------------

            elif method == "PUT":

                request_json = json.dumps(
                    request_data,
                    indent=4
                )

                file.write(
                    "    response = requests.put(\n"
                    "        url,\n"
                    f"        json={request_json},\n"
                    "        timeout=REQUEST_TIMEOUT\n"
                    "    )\n"
                )

            # ----------------------------------------------------
            # PATCH
            # ----------------------------------------------------

            elif method == "PATCH":

                request_json = json.dumps(
                    request_data,
                    indent=4
                )

                file.write(
                    "    response = requests.patch(\n"
                    "        url,\n"
                    f"        json={request_json},\n"
                    "        timeout=REQUEST_TIMEOUT\n"
                    "    )\n"
                )

            # ----------------------------------------------------
            # DELETE
            # ----------------------------------------------------

            elif method == "DELETE":

                file.write(
                    "    response = requests.delete(\n"
                    "        url,\n"
                    "        timeout=REQUEST_TIMEOUT\n"
                    "    )\n"
                )

            # ----------------------------------------------------
            # Other HTTP methods
            # ----------------------------------------------------

            else:

                request_json = json.dumps(
                    request_data,
                    indent=4
                )

                file.write(
                    "    response = requests.request(\n"
                    f"        {method!r},\n"
                    "        url,\n"
                    f"        json={request_json},\n"
                    "        timeout=REQUEST_TIMEOUT\n"
                    "    )\n"
                )

            # ----------------------------------------------------
            # Assertion
            # ----------------------------------------------------

            if expected_status_code is not None:

                file.write(
                    f"    assert response.status_code == "
                    f"{expected_status_code}\n"
                )

            file.write("\n\n")

    return file_path


# ============================================================
# GET MY PROJECTS
# ============================================================

@router.get(
    "/",
    response_model=List[schemas.ProjectResponse]
)
def get_projects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):

    projects = (
        db.query(models.Project)
        .filter(
            models.Project.owner_id == current_user.id
        )
        .all()
    )

    return projects


# ============================================================
# CREATE PROJECT
# ============================================================

@router.post(
    "/",
    response_model=schemas.ProjectResponse
)
def create_project(
    project: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):

    new_project = models.Project(
        name=project.name,
        description=project.description,
        owner_id=current_user.id
    )

    db.add(new_project)

    db.commit()

    db.refresh(new_project)

    return new_project


# ============================================================
# GENERATE AND EXECUTE PROJECT TEST CASES
# ============================================================

@router.post(
    "/{project_id}/generate"
)
def generate_project_test_cases(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):

    # --------------------------------------------------------
    # Check project ownership
    # --------------------------------------------------------

    project = get_user_project(
        project_id,
        current_user.id,
        db
    )

    # --------------------------------------------------------
    # Get APIs belonging to project
    # --------------------------------------------------------

    apis = (
        db.query(models.API)
        .filter(
            models.API.project_id == project.id
        )
        .all()
    )

    if not apis:

        raise HTTPException(
            status_code=404,
            detail="No APIs found in this project"
        )

    all_generated_cases = []

    generated_count = 0

    # --------------------------------------------------------
    # Generate and execute tests for every API
    # --------------------------------------------------------

    for api in apis:

        try:

            test_cases = (
                generate_ai_test_cases_for_api(api)
            )

            if not test_cases:
                continue

            for test_case in test_cases:

                # ------------------------------------------------
                # Request data
                # ------------------------------------------------

                request_data = test_case.get(
                    "request_data",
                    {}
                )

                if isinstance(
                    request_data,
                    (dict, list)
                ):

                    request_data = json.dumps(
                        request_data
                    )

                elif request_data is None:

                    request_data = ""

                else:

                    request_data = str(
                        request_data
                    )

                # ------------------------------------------------
                # Expected result
                # ------------------------------------------------

                expected_result = test_case.get(
                    "expected_result",
                    ""
                )

                if isinstance(
                    expected_result,
                    (dict, list)
                ):

                    expected_result = json.dumps(
                        expected_result
                    )

                elif expected_result is None:

                    expected_result = ""

                else:

                    expected_result = str(
                        expected_result
                    )

                # ------------------------------------------------
                # Actual result
                # ------------------------------------------------

                actual_result = test_case.get(
                    "actual_result",
                    ""
                )

                if isinstance(
                    actual_result,
                    (dict, list)
                ):

                    actual_result = json.dumps(
                        actual_result
                    )

                elif actual_result is None:

                    actual_result = ""

                else:

                    actual_result = str(
                        actual_result
                    )

                # ------------------------------------------------
                # Test code
                # ------------------------------------------------

                test_code = test_case.get(
                    "test_code",
                    ""
                )

                # ------------------------------------------------
                # Save test case to database
                # ------------------------------------------------

                test_case_record = models.TestCase(

                    api_id=api.id,

                    title=test_case.get(
                        "title",
                        "Generated Test Case"
                    ),

                    method=test_case.get(
                        "method",
                        api.method
                    ),

                    endpoint=test_case.get(
                        "endpoint",
                        api.endpoint
                    ),

                    test_type=test_case.get(
                        "test_type",
                        "functional"
                    ),

                    description=test_case.get(
                        "description",
                        ""
                    ),

                    request_data=request_data,

                    expected_result=expected_result,

                    expected_status_code=test_case.get(
                        "expected_status_code"
                    ),

                    test_code=test_code,

                    actual_result=actual_result,

                    execution_status=test_case.get(
                        "execution_status",
                        "NOT RUN"
                    )
                )

                db.add(
                    test_case_record
                )

                # ------------------------------------------------
                # Add to response
                # ------------------------------------------------

                all_generated_cases.append(
                    {
                        "api_id": api.id,

                        "title":
                            test_case_record.title,

                        "method":
                            test_case_record.method,

                        "endpoint":
                            test_case_record.endpoint,

                        "test_type":
                            test_case_record.test_type,

                        "description":
                            test_case_record.description,

                        "request_data":
                            request_data,

                        "expected_result":
                            expected_result,

                        "expected_status_code":
                            test_case_record.expected_status_code,

                        "test_code":
                            test_code,

                        "actual_result":
                            actual_result,

                        "execution_status":
                            test_case_record.execution_status
                    }
                )

                generated_count += 1

        except Exception as error:

            print(
                f"Error generating tests for "
                f"{api.method} {api.endpoint}: {error}"
            )

            continue

    # --------------------------------------------------------
    # Commit generated test cases
    # --------------------------------------------------------

    db.commit()

    # --------------------------------------------------------
    # Check if generation failed for every API
    # --------------------------------------------------------

    if not all_generated_cases:

        raise HTTPException(
            status_code=500,
            detail="Test case generation failed for all APIs"
        )

    # --------------------------------------------------------
    # Write generated Python tests to file
    # --------------------------------------------------------

    try:

        write_generated_tests_to_file(
            project_id,
            all_generated_cases
        )

    except Exception as error:

        print(
            f"Warning: could not write generated "
            f"test file: {error}"
        )

    # --------------------------------------------------------
    # Return result
    # --------------------------------------------------------

    return {
        "message":
            "Test cases generated and executed successfully",

        "project_id":
            project_id,

        "api_count":
            len(apis),

        "test_case_count":
            generated_count,

        "test_cases":
            all_generated_cases
    }


# ============================================================
# GET PROJECT TEST CASES
# ============================================================

@router.get(
    "/{project_id}/test-cases"
)
def get_project_test_cases(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):

    # --------------------------------------------------------
    # Check project ownership
    # --------------------------------------------------------

    project = get_user_project(
        project_id,
        current_user.id,
        db
    )

    # --------------------------------------------------------
    # Get API IDs
    # --------------------------------------------------------

    api_ids = [
        api.id
        for api in project.apis
    ]

    if not api_ids:

        return {
            "project_id": project_id,
            "test_cases": []
        }

    # --------------------------------------------------------
    # Get test cases
    # --------------------------------------------------------

    test_cases = (
        db.query(models.TestCase)
        .filter(
            models.TestCase.api_id.in_(api_ids)
        )
        .all()
    )

    result = []

    for test_case in test_cases:

        result.append(
            {
                "id":
                    test_case.id,

                "api_id":
                    test_case.api_id,

                "title":
                    test_case.title,

                "method":
                    test_case.method,

                "endpoint":
                    test_case.endpoint,

                "test_type":
                    test_case.test_type,

                "description":
                    test_case.description,

                "request_data":
                    test_case.request_data,

                "expected_result":
                    test_case.expected_result,

                "expected_status_code":
                    test_case.expected_status_code,

                "test_code":
                    test_case.test_code,

                "actual_result":
                    test_case.actual_result,

                "execution_status":
                    test_case.execution_status
            }
        )

    return {
        "project_id":
            project_id,

        "test_cases":
            result
    }