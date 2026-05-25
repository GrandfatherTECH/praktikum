from datetime import UTC, datetime

from fastapi import FastAPI

from app.api.v1 import api_router
from app.core.config import settings
from app.schemas.common import HealthResponse

app = FastAPI(title=settings.app_name)
app.include_router(api_router)


@app.get("/api/v1/health", response_model=HealthResponse)
async def healthcheck() -> HealthResponse:
    return HealthResponse(status="ok", timestamp=datetime.now(UTC))
