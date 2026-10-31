from typing import Annotated
from pydantic import BaseModel, StrictBool, StrictStr, StringConstraints


class TaskCreate(BaseModel):
    title: Annotated[StrictStr, StringConstraints(strip_whitespace=True, min_length=1)]


class TaskUpdate(BaseModel):
    completed: StrictBool


class TaskResponse(BaseModel):
    id: str
    title: str
    completed: bool


class HealthResponse(BaseModel):
    status: str
    instance: str
    requestId: str
    previous: str | None = None


class APIError(BaseModel):
    error: str
