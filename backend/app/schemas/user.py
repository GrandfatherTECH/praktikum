from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import UserRole
from app.schemas.common import ORMModel


class UserRead(ORMModel):
    id: int
    full_name: str
    username: str
    role: UserRole
    department_id: int | None
    position: str | None
    is_active: bool
    is_approved: bool
    must_change_password: bool
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=256)
    role: UserRole
    department_id: int | None = None
    position: str | None = Field(default=None, max_length=255)
    is_active: bool = True


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    role: UserRole | None = None
    department_id: int | None = None
    position: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None
    is_approved: bool | None = None


class UserApproveResponse(BaseModel):
    message: str
    user: UserRead


class OneTimePasswordResponse(BaseModel):
    message: str
    temporary_password: str
    user: UserRead
