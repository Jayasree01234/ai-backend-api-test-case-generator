import json
import os
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.ai.generator import generate_ai_test_cases
from app.auth import get_current_user
from app.database import get_db


router = APIRouter(
    prefix="/projects",
    tags=["Projects"]
)


def get_user_project(
    project_id: int,
    current_user: models.User,
    db: Session
):
    project = (
        db.query(models.Project)
        .filter(
            models.Project.id == project_id,
            models.Project.owner_id == current_user.id
        )
        .first()
    )

    if project is None:
        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    return project


def make_unique_test_code(
    code: str,
    used_names: set
):
    if not code:
        return ""

    match = re.search(
        r"def\s+(test_[A-Za-z0-9_]+)\s*\(",
        code
    )

    if match is None:
        return code

    original_name = match.group(1)
    new_name = original_name
    counter = 2

    while new_name in used_names:
        new_name = f"{original_name}_{counter}"
        counter += 1

    used_names.add(new_name)

    if new_name != original_name:
        code = code.replace(
            f"def {original_name}(",
            f"def {new_name}(",
            1
        )

    return code


def write_generated_tests_to_file(
    test_cases
):
    project_root = os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "..",
            ".."
        )
    )

    tests_folder = os.path.join(
        project_root,
        "tests"
    )

    os.makedirs(
        tests_folder,
        exist_ok=True
    )

    test_file = os.path.join(
        tests_folder,
        "test_generated_cases.py"
    )

    header = """import requests


BASE_URL = "http://127.0.0.1:8000"


"""

    used_names = set()
    test_functions = []

    for index, test_case in enumerate(
        test_cases,
        start=1
    ):
        test_code = test_case.get(
            "test_code",
            ""
        )

        if test_code:
            test_code = make_unique_test_code(
                test_code,
                used_names
            )

            test_functions.append(
                test_code.strip()
            )

            continue

        method = str(
            test_case.get(
                "method",
                "GET"
            )
        ).upper()

        endpoint = test_case.get(
            "endpoint",
            "/"
        )

        title = test_case.get(
            "title",
            f"Generated Test Case {index}"
        )

        test_name = re.sub(
            r"[^a-zA-Z0-9_]+",
            "_",
            title.lower()
        ).strip("_")

        if not test_name:
            test_name = f"generated_test_{index}"

        test_name = f"test_{test_name}"

        if test_name in used_names:
            test_name = f"{test_name}_{index}"

        used_names.add(test_name)

        request_data = test_case.get(
            "request_data",
            {}
        )

        if isinstance(
            request_data,
            str
        ):
            try:
                request_data = json.loads(
                    request_data
                )
            except Exception:
                request_data = {}

        if not isinstance(
            request_data,
            dict
        ):
            request_data = {}

        request_json = json.dumps(
            request_data,
            indent=4
        )

        expected_status = test_case.get(
            "expected_status_code"
        )

        if expected_status is None:
            expected_result = test_case.get(
                "expected_result",
                ""
            )

            status_match = re.search(
                r"\b([1-5][0-9]{2})\b",
                str(expected_result)
            )

            if status_match:
                expected_status = int(
                    status_match.group(1)
                )
            else:
                expected_status = 200

        try:
            expected_status = int(
                expected_status
            )
        except (
            ValueError,
            TypeError
        ):
            expected_status = 200

        executable_endpoint = re.sub(
            r"\{[A-Za-z_][A-Za-z0-9_]*\}",
            "1",
            endpoint
        )

        if method == "GET":
            code = f"""# {title}
def {test_name}():
    response = requests.get(
        f"{{BASE_URL}}{executable_endpoint}"
    )
    assert response.status_code == {expected_status}
"""

        elif method == "POST":
            code = f"""# {title}
def {test_name}():
    payload = {request_json}
    response = requests.post(
        f"{{BASE_URL}}{executable_endpoint}",
        json=payload
    )
    assert response.status_code == {expected_status}
"""

        elif method == "PUT":
            code = f"""# {title}
def {test_name}():
    payload = {request_json}
    response = requests.put(
        f"{{BASE_URL}}{executable_endpoint}",
        json=payload
    )
    assert response.status_code == {expected_status}
"""

        elif method == "PATCH":
            code = f"""# {title}
def {test_name}():
    payload = {request_json}
    response = requests.patch(
        f"{{BASE_URL}}{executable_endpoint}",
        json=payload
    )
    assert response.status_code == {expected_status}
"""

        elif method == "DELETE":
            code = f"""# {title}
def {test_name}():
    response = requests.delete(
        f"{{BASE_URL}}{executable_endpoint}"
    )
    assert response.status_code == {expected_status}
"""

        else:
            code = f"""# {title}
def {test_name}():
    response = requests.request(
        "{method}",
        f"{{BASE_URL}}{executable_endpoint}"
    )
    assert response.status_code == {expected_status}
"""

        test_functions.append(
            code.strip()
        )

    with open(
        test_file,
        "w",
        encoding="utf-8"
    ) as file:
        file.write(header)

        for test_function in test_functions:
            file.write(test_function)
            file.write("\n\n\n")

    return test_file


@router.get(
    "/",
    response_model=list[schemas.ProjectResponse]
)
def get_projects(
    current_user: models.User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db)
):
    projects = (
        db.query(models.Project)
        .filter(
            models.Project.owner_id == current_user.id
        )
        .all()
    )

    return projects


@router.post(
    "/",
    response_model=schemas.ProjectResponse
)
def create_project(
    project: schemas.ProjectCreate,
    current_user: models.User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db)
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


@router.post(
    "/{project_id}/generate"
)
def generate_test_cases(
    project_id: int,
    current_user: models.User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db)
):
    project = get_user_project(
        project_id,
        current_user,
        db
    )

    apis = (
        db.query(models.API)
        .filter(
            models.API.project_id == project.id
        )
        .all()
    )

    if not apis:
        raise HTTPException(
            status_code=400,
            detail="No APIs found in this project"
        )

    generated_test_cases = []

    for api in apis:
        try:
            test_cases = generate_ai_test_cases(api)

        except Exception as error:
            print(
                f"Error generating tests for "
                f"{api.method} {api.endpoint}: "
                f"{error}"
            )
            continue

        if not test_cases:
            continue

        if not isinstance(
            test_cases,
            list
        ):
            continue

        for test_case in test_cases:
            if not isinstance(
                test_case,
                dict
            ):
                continue

            title = test_case.get(
                "title",
                "Generated Test Case"
            )

            method = test_case.get(
                "method",
                api.method
            )

            endpoint = test_case.get(
                "endpoint",
                api.endpoint
            )

            test_type = test_case.get(
                "test_type",
                "Functional"
            )

            description = test_case.get(
                "description",
                ""
            )

            request_data = test_case.get(
                "request_data",
                {}
            )

            expected_result = test_case.get(
                "expected_result",
                ""
            )

            expected_status_code = test_case.get(
                "expected_status_code"
            )

            if isinstance(
                request_data,
                (dict, list)
            ):
                request_data_for_db = json.dumps(
                    request_data
                )
            else:
                request_data_for_db = str(
                    request_data
                )

            if expected_status_code is None:
                status_match = re.search(
                    r"\b([1-5][0-9]{2})\b",
                    str(expected_result)
                )

                if status_match:
                    expected_status_code = int(
                        status_match.group(1)
                    )
                else:
                    expected_status_code = 200

            try:
                expected_status_code = int(
                    expected_status_code
                )
            except (
                ValueError,
                TypeError
            ):
                expected_status_code = 200

            database_test_case = models.TestCase(
                api_id=api.id,
                title=title,
                method=method,
                endpoint=endpoint,
                test_type=test_type,
                description=description,
                request_data=request_data_for_db,
                expected_result=expected_result,
                expected_status_code=expected_status_code,
                test_code=test_case.get(
                    "test_code",
                    ""
                ),
                actual_result=test_case.get(
                    "actual_result",
                    ""
                ),
                execution_status=test_case.get(
                    "execution_status",
                    "NOT RUN"
                )
            )

            db.add(database_test_case)

            generated_test_cases.append(
                {
                    "title": title,
                    "method": method,
                    "endpoint": endpoint,
                    "test_type": test_type,
                    "description": description,
                    "request_data": request_data,
                    "expected_result": expected_result,
                    "expected_status_code": expected_status_code,
                    "test_code": test_case.get(
                        "test_code",
                        ""
                    ),
                    "actual_result": test_case.get(
                        "actual_result",
                        ""
                    ),
                    "execution_status": test_case.get(
                        "execution_status",
                        "NOT RUN"
                    )
                }
            )

    if not generated_test_cases:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="No test cases were generated"
        )

    db.commit()

    write_generated_tests_to_file(
        generated_test_cases
    )

    return {
        "message": "Test cases generated successfully",
        "project_id": project.id,
        "apis_processed": len(apis),
        "test_cases_generated": len(
            generated_test_cases
        ),
        "test_file": "tests/test_generated_cases.py",
        "test_cases": generated_test_cases
    }


@router.get(
    "/{project_id}/test-cases"
)
def get_test_cases(
    project_id: int,
    current_user: models.User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db)
):
    project = get_user_project(
        project_id,
        current_user,
        db
    )

    apis = (
        db.query(models.API)
        .filter(
            models.API.project_id == project.id
        )
        .all()
    )

    if not apis:
        return []

    api_ids = [
        api.id
        for api in apis
    ]

    test_cases = (
        db.query(models.TestCase)
        .filter(
            models.TestCase.api_id.in_(api_ids)
        )
        .all()
    )

    return test_cases