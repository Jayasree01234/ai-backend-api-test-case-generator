import json

import yaml
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile
)
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import get_current_user
from app.database import get_db


router = APIRouter(
    prefix="/projects",
    tags=["APIs"]
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
# CREATE API
# ============================================================

@router.post(
    "/{project_id}/apis",
    response_model=schemas.APIResponse
)
def create_api(
    project_id: int,
    api: schemas.APICreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = get_user_project(
        project_id,
        db,
        current_user
    )

    new_api = models.API(
        project_id=project.id,
        method=api.method.upper(),
        endpoint=api.endpoint,
        request_body=api.request_body,
        openapi_details=None
    )

    db.add(new_api)
    db.commit()
    db.refresh(new_api)

    return new_api


# ============================================================
# GET PROJECT APIs
# ============================================================

@router.get(
    "/{project_id}/apis",
    response_model=list[schemas.APIResponse]
)
def get_project_apis(
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

    return apis


# ============================================================
# IMPORT OPENAPI / SWAGGER
# ============================================================

@router.post(
    "/{project_id}/import-openapi"
)
async def import_openapi(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = get_user_project(
        project_id,
        db,
        current_user
    )

    # --------------------------------------------------------
    # READ FILE
    # --------------------------------------------------------

    contents = await file.read()
    filename = file.filename or ""

    # --------------------------------------------------------
    # PARSE JSON / YAML
    # --------------------------------------------------------

    try:
        if filename.lower().endswith(".json"):
            specification = json.loads(
                contents.decode("utf-8")
            )

        elif filename.lower().endswith(
            (".yaml", ".yml")
        ):
            specification = yaml.safe_load(
                contents.decode("utf-8")
            )

        else:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Only JSON, YAML, and YML "
                    "files are supported"
                )
            )

    except HTTPException:
        raise

    except (
        json.JSONDecodeError,
        UnicodeDecodeError,
        yaml.YAMLError
    ) as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid OpenAPI file"
        ) from exc

    # --------------------------------------------------------
    # VALIDATE SPECIFICATION
    # --------------------------------------------------------

    if not isinstance(specification, dict):
        raise HTTPException(
            status_code=400,
            detail="Invalid OpenAPI specification"
        )

    paths = specification.get("paths", {})

    if not isinstance(paths, dict) or not paths:
        raise HTTPException(
            status_code=400,
            detail="No API paths found in OpenAPI file"
        )

    # --------------------------------------------------------
    # SUPPORTED HTTP METHODS
    # --------------------------------------------------------

    supported_methods = {
        "get",
        "post",
        "put",
        "patch",
        "delete",
        "options",
        "head"
    }

    apis_imported = []

    # ========================================================
    # IMPORT EVERY ENDPOINT
    # ========================================================

    for endpoint, endpoint_data in paths.items():

        if not isinstance(endpoint_data, dict):
            continue

        for method, method_data in endpoint_data.items():

            if method.lower() not in supported_methods:
                continue

            if not isinstance(method_data, dict):
                method_data = {}

            method_upper = method.upper()

            # ------------------------------------------------
            # REQUEST BODY
            # ------------------------------------------------

            request_body_data = method_data.get(
                "requestBody"
            )

            request_body = ""

            if request_body_data:
                try:
                    request_body = json.dumps(
                        request_body_data
                    )
                except (TypeError, ValueError):
                    request_body = str(
                        request_body_data
                    )

            # ------------------------------------------------
            # STORE OPENAPI DETAILS
            # ------------------------------------------------

            openapi_details = {}

            if request_body_data:
                openapi_details["requestBody"] = (
                    request_body_data
                )

            parameters = method_data.get(
                "parameters",
                []
            )

            if isinstance(parameters, list) and parameters:
                openapi_details["parameters"] = parameters

            responses = method_data.get(
                "responses",
                {}
            )

            if isinstance(responses, dict) and responses:
                openapi_details["responses"] = responses

            for key in (
                "summary",
                "description",
                "operationId",
                "tags"
            ):
                if key in method_data:
                    openapi_details[key] = method_data[key]

            openapi_details_json = json.dumps(
                openapi_details
            )

            # ------------------------------------------------
            # CREATE API RECORD
            # ------------------------------------------------

            new_api = models.API(
                project_id=project.id,
                method=method_upper,
                endpoint=endpoint,
                request_body=request_body,
                openapi_details=openapi_details_json
            )

            db.add(new_api)

            apis_imported.append(
                {
                    "method": method_upper,
                    "endpoint": endpoint
                }
            )

    # --------------------------------------------------------
    # CHECK RESULT
    # --------------------------------------------------------

    if not apis_imported:
        raise HTTPException(
            status_code=400,
            detail=(
                "No supported API endpoints "
                "found in OpenAPI file"
            )
        )

    # --------------------------------------------------------
    # SAVE
    # --------------------------------------------------------

    db.commit()

    # --------------------------------------------------------
    # RETURN RESULT
    # --------------------------------------------------------

    return {
        "message": "OpenAPI file imported successfully",
        "project_id": project.id,
        "filename": filename,
        "apis_imported": apis_imported,
        "total_apis": len(apis_imported)
    }