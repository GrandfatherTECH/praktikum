from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.departments import router as departments_router
from app.api.v1.documents import audit_router, incoming_router, resolution_router, router as documents_router
from app.api.v1.users import router as users_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(departments_router)
api_router.include_router(documents_router)
api_router.include_router(incoming_router)
api_router.include_router(resolution_router)
api_router.include_router(audit_router)
