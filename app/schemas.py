from pydantic import BaseModel


# ============================================================
# AUTHENTICATION
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
# PROJECT
# ============================================================

class ProjectCreate(BaseModel):
    name: str
    description: str | None = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: str | None = None

    class Config:
        from_attributes = True


# ============================================================
# API
# ============================================================

class APICreate(BaseModel):
    method: str
    endpoint: str
    request_body: str | None = None


class APIResponse(BaseModel):
    id: int
    project_id: int
    method: str
    endpoint: str
    request_body: str | None = None
    openapi_details: str | None = None

    class Config:
        from_attributes = True


# ============================================================
# TEST CASE
# ============================================================

class TestCaseResponse(BaseModel):
    id: int
    api_id: int
    title: str
    method: str
    endpoint: str
    test_type: str
    description: str
    request_data: str | None = None
    expected_result: str

    class Config:
        from_attributes = True


class GeneratedTestCase(BaseModel):
    title: str
    method: str
    endpoint: str
    test_type: str
    description: str
    request_data: str | None = None
    expected_result: str


class GenerateResponse(BaseModel):
    project_id: int
    test_cases: list[GeneratedTestCase]