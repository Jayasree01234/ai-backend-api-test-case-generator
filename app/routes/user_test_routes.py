
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional


router = APIRouter(tags=["Test Users"])


# Temporary in-memory storage for testing
users = []


class UserCreate(BaseModel):
    name: str
    email: str
    password: Optional[str] = None
    age: Optional[int] = None


@router.get("/users")
def get_all_users():
    return {
        "users": users
    }


@router.post("/users", status_code=201)
def create_user(user: UserCreate):

    # Validate email
    if "@" not in user.email:
        raise HTTPException(
            status_code=400,
            detail="Invalid email address"
        )

    # Validate age
    if user.age is not None and user.age < 0:
        raise HTTPException(
            status_code=400,
            detail="Invalid age value"
        )

    # Validate password
    if user.password is not None and len(user.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long"
        )

    new_user = {
        "id": len(users) + 1,
        "name": user.name,
        "email": user.email
    }

    if user.age is not None:
        new_user["age"] = user.age

    users.append(new_user)

    return new_user


@router.get("/users/{user_id}")
def get_user_by_id(user_id: int):

    for user in users:
        if user["id"] == user_id:
            return user

    raise HTTPException(
        status_code=404,
        detail="User not found"
    )
