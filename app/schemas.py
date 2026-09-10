from pydantic import BaseModel
from typing import Optional, Any


# ============================================================
# USER SCHEMAS
# ============================================================

class UserCreate(BaseModel):
    name: str
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


# ============================================================
# PROJECT SCHEMAS
# ============================================================

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    owner_id: int

    class Config:
        from_attributes = True


# ============================================================
# API SCHEMAS
# ============================================================

class APICreate(BaseModel):
    method: str
    endpoint: str
    request_body: Optional[str] = None


class APIResponse(BaseModel):
    id: int
    project_id: int
    method: str
    endpoint: str
    request_body: Optional[str] = None
    openapi_details: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================================
# TEST CASE SCHEMAS
# ============================================================

class TestCase(BaseModel):
    title: str
    method: str
    endpoint: str

    test_type: Optional[str] = None

    description: Optional[str] = None

    request_data: Optional[Any] = None

    expected_result: Optional[str] = None

    # Expected HTTP status code
    expected_status_code: Optional[int] = None

    # Generated executable Python test code
    test_code: Optional[str] = None

    # Actual response received from API
    actual_result: Optional[str] = None

    # PASS / FAIL / NOT RUN
    execution_status: Optional[str] = "NOT RUN"


class TestCaseResponse(BaseModel):
    id: int
    api_id: int

    title: str
    method: str
    endpoint: str

    test_type: Optional[str] = None

    description: Optional[str] = None

    request_data: Optional[str] = None

    expected_result: Optional[str] = None

    # Expected HTTP status code
    expected_status_code: Optional[int] = None

    # Generated executable Python code
    test_code: Optional[str] = None

    # Actual API response
    actual_result: Optional[str] = None

    # PASS / FAIL / NOT RUN
    execution_status: Optional[str] = "NOT RUN"

    class Config:
        from_attributes = True

        # ============================================================
# GENERATE RESPONSE
# ============================================================

class GenerateResponse(BaseModel):
    project_id: int
    test_cases: list[TestCaseResponse]