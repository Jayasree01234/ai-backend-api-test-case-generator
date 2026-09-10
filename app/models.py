from sqlalchemy import Column, Integer, String, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.database import Base


# ============================================================
# USER MODEL
# ============================================================

class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String,
        nullable=False
    )

    email = Column(
        String,
        unique=True,
        index=True,
        nullable=False
    )

    password = Column(
        String,
        nullable=False
    )

    projects = relationship(
        "Project",
        back_populates="owner"
    )


# ============================================================
# PROJECT MODEL
# ============================================================

class Project(Base):
    __tablename__ = "projects"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String,
        nullable=False
    )

    description = Column(
        String,
        nullable=True
    )

    owner_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    owner = relationship(
        "User",
        back_populates="projects"
    )

    apis = relationship(
        "API",
        back_populates="project",
        cascade="all, delete-orphan"
    )


# ============================================================
# API MODEL
# ============================================================

class API(Base):
    __tablename__ = "apis"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    project_id = Column(
        Integer,
        ForeignKey("projects.id"),
        nullable=False
    )

    method = Column(
        String,
        nullable=False
    )

    endpoint = Column(
        String,
        nullable=False
    )

    request_body = Column(
        Text,
        nullable=True
    )

    openapi_details = Column(
        Text,
        nullable=True
    )

    project = relationship(
        "Project",
        back_populates="apis"
    )

    test_cases = relationship(
        "TestCase",
        back_populates="api",
        cascade="all, delete-orphan"
    )


# ============================================================
# TEST CASE MODEL
# ============================================================

class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    api_id = Column(
        Integer,
        ForeignKey("apis.id"),
        nullable=False
    )

    title = Column(
        String,
        nullable=False
    )

    method = Column(
        String,
        nullable=False
    )

    endpoint = Column(
        String,
        nullable=False
    )

    test_type = Column(
        String,
        nullable=True
    )

    description = Column(
        Text,
        nullable=True
    )

    request_data = Column(
        Text,
        nullable=True
    )

    expected_result = Column(
        Text,
        nullable=True
    )

    # Expected HTTP status returned by the API
    expected_status_code = Column(
        Integer,
        nullable=True
    )

    # Generated executable Python test code
    test_code = Column(
        Text,
        nullable=True
    )

    # Actual response received after executing the test
    actual_result = Column(
        Text,
        nullable=True
    )

    # PASS / FAIL / NOT RUN
    execution_status = Column(
        String,
        nullable=True,
        default="NOT RUN"
    )

    api = relationship(
        "API",
        back_populates="test_cases"
    )