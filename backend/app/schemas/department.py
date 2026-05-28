from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class DepartmentRead(ORMModel):
    id: int
    name: str
    head_user_id: int | None
    member_user_ids: list[int] = Field(default_factory=list)
    is_active: bool
    created_at: datetime
    updated_at: datetime


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    head_user_id: int | None = None
    member_user_ids: list[int] = Field(default_factory=list)
    is_active: bool = True


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    head_user_id: int | None = None
    member_user_ids: list[int] | None = None
    is_active: bool | None = None
