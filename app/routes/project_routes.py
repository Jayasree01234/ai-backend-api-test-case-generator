import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import get_current_user
from app.database import get_db
from app.ai.generator import generate_ai_test_cases

# NEW IMPORTS
from app.test_executor import (
    generate_test_code,
    execute_test_case
)


router = APIRouter(
    prefix="/projects",
    tags=["Projects"]
)


# ============================================================
# HELPER: CHECK PROJECT ACCESS
# ============================================================

def get_user_project(
    project_id: int,
    db: Session,
    current_user: models.User
):
    project = (
        db.query(models.Project)
        .filter(models.Project.id == project_id)
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to access this project"
        )

    return project


# ============================================================
# GET MY PROJECTS
# ============================================================

@router.get(
    "/",
    response_model=list[schemas.ProjectResponse]
)
def get_my_projects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    projects = (
        db.query(models.Project)
        .filter(models.Project.owner_id == current_user.id)
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
# GENERATE AND EXECUTE TEST CASES
# ============================================================

@router.post(
    "/{project_id}/generate",
    response_model=schemas.GenerateResponse
)
def generate_test_cases(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = get_user_project(
        project_id,
        db,
        current_user
    )

    # Get APIs
    apis = (
        db.query(models.API)
        .filter(models.API.project_id == project.id)
        .all()
    )

    if not apis:
        raise HTTPException(
            status_code=400,
            detail="No APIs found in this project"
        )

    # Delete previous test cases
    api_ids = [api.id for api in apis]

    (
        db.query(models.TestCase)
        .filter(models.TestCase.api_id.in_(api_ids))
        .delete(synchronize_session=False)
    )

    db.flush()

    generated_test_cases = []

    # ========================================================
    # PROCESS EACH API
    # ========================================================

    for api in apis:

        openapi_details = {}

        if api.openapi_details:
            try:
                openapi_details = json.loads(
                    api.openapi_details
                )
            except (json.JSONDecodeError, TypeError):
                openapi_details = {}

        # ----------------------------------------------------
        # GENERATE AI TEST CASES
        # ----------------------------------------------------

        try:
            ai_test_cases = generate_ai_test_cases(
                method=api.method,
                endpoint=api.endpoint,
                request_body=api.request_body or "",
                openapi_details=openapi_details
            )

        except Exception as exc:
            db.rollback()

            raise HTTPException(
                status_code=500,
                detail=(
                    "AI test case generation failed: "
                    f"{str(exc)}"
                )
            ) from exc

        # ----------------------------------------------------
        # SAVE AND EXECUTE EACH TEST CASE
        # ----------------------------------------------------

        for test_case in ai_test_cases:

            database_test_case = models.TestCase(
                api_id=api.id,

                title=test_case.get(
                    "title",
                    "Untitled Test"
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
                    "Functional"
                ),

                description=test_case.get(
                    "description",
                    ""
                ),

                request_data=test_case.get(
                    "request_data",
                    ""
                ),

                expected_result=test_case.get(
                    "expected_result",
                    ""
                ),

                execution_status="NOT RUN"
            )

            # ------------------------------------------------
            # GENERATE PYTHON TEST CODE
            # ------------------------------------------------

            database_test_case.test_code = generate_test_code(
                database_test_case
            )

            # Save temporarily to database
            db.add(database_test_case)
            db.flush()

            # ------------------------------------------------
            # EXECUTE THE TEST
            # ------------------------------------------------

            execution_result = execute_test_case(
                database_test_case
            )

            database_test_case.actual_result = (
                execution_result["actual_result"]
            )

            database_test_case.execution_status = (
                execution_result["execution_status"]
            )

            # ------------------------------------------------
            # ADD RESULT FOR FRONTEND
            # ------------------------------------------------

            generated_test_cases.append(
                {
                    "title": database_test_case.title,
                    "method": database_test_case.method,
                    "endpoint": database_test_case.endpoint,
                    "test_type": database_test_case.test_type,
                    "description": database_test_case.description,
                    "request_data": database_test_case.request_data,
                    "expected_result": database_test_case.expected_result,

                    "test_code": database_test_case.test_code,
                    "actual_result": database_test_case.actual_result,
                    "execution_status": database_test_case.execution_status
                }
            )

    # ========================================================
    # SAVE EVERYTHING
    # ========================================================

    db.commit()

    return {
        "project_id": project.id,
        "test_cases": generated_test_cases
    }


# ============================================================
# GET GENERATED TEST CASES
# ============================================================

@router.get(
    "/{project_id}/test-cases",
    response_model=list[schemas.TestCaseResponse]
)
def get_test_cases(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = get_user_project(
        project_id,
        db,
        current_user
    )

    apis = (
        db.query(models.API)
        .filter(models.API.project_id == project.id)
        .all()
    )

    if not apis:
        return []

    api_ids = [api.id for api in apis]

    test_cases = (
        db.query(models.TestCase)
        .filter(models.TestCase.api_id.in_(api_ids))
        .all()
    )

    return test_cases