from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import (
    build_session_expiry,
    generate_session_token,
    hash_session_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db_session
from app.models.session import Session
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, LoginResponse, MeResponse
from app.schemas.common import MessageResponse
from app.services.audit import create_audit_log

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db_session),
) -> LoginResponse:
    result = await db.execute(select(User).where(User.username == payload.username))
    user = result.scalar_one_or_none()

    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    if not user or not verify_password(payload.password, user.password_hash):
        await create_audit_log(
            db,
            actor_id=user.id if user else None,
            action="login.failure",
            entity_type="auth",
            ip_address=ip,
            user_agent=user_agent,
            after={"username": payload.username},
        )
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        await create_audit_log(
            db,
            actor_id=user.id,
            action="login.failure",
            entity_type="auth",
            entity_id=user.id,
            ip_address=ip,
            user_agent=user_agent,
            after={"reason": "inactive"},
        )
        await db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")

    if not user.is_approved and user.username != settings.initial_admin_username:
        await create_audit_log(
            db,
            actor_id=user.id,
            action="login.failure",
            entity_type="auth",
            entity_id=user.id,
            ip_address=ip,
            user_agent=user_agent,
            after={"reason": "not_approved"},
        )
        await db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not approved")

    raw_token = generate_session_token()
    session = Session(
        user_id=user.id,
        session_token_hash=hash_session_token(raw_token),
        expires_at=build_session_expiry(),
    )
    db.add(session)

    await create_audit_log(
        db,
        actor_id=user.id,
        action="login.success",
        entity_type="auth",
        entity_id=user.id,
        ip_address=ip,
        user_agent=user_agent,
    )
    await db.commit()

    response.set_cookie(
        key=settings.session_cookie_name,
        value=raw_token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        domain=settings.session_cookie_domain,
        max_age=settings.session_ttl_hours * 3600,
        path="/",
    )

    return LoginResponse(user=user)


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, str]:
    session_token = request.cookies.get(settings.session_cookie_name)
    if session_token:
        token_hash = hash_session_token(session_token)
        result = await db.execute(
            select(Session).where(
                and_(
                    Session.session_token_hash == token_hash,
                    Session.user_id == current_user.id,
                    Session.revoked_at.is_(None),
                )
            )
        )
        session = result.scalar_one_or_none()
        if session:
            session.revoked_at = datetime.now(UTC)

    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="logout",
        entity_type="auth",
        entity_id=current_user.id,
        ip_address=ip,
        user_agent=user_agent,
    )
    await db.commit()

    response.delete_cookie(key=settings.session_cookie_name, path="/", domain=settings.session_cookie_domain)
    return {"message": "Logged out"}


@router.get("/me", response_model=MeResponse)
async def me(current_user: User = Depends(get_current_user)) -> MeResponse:
    return MeResponse(user=current_user)


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is invalid")

    current_user.password_hash = hash_password(payload.new_password)
    current_user.must_change_password = False

    await db.execute(
        update(Session)
        .where(
            and_(
                Session.user_id == current_user.id,
                Session.revoked_at.is_(None),
            )
        )
        .values(revoked_at=datetime.now(UTC))
    )

    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="password.changed",
        entity_type="user",
        entity_id=current_user.id,
        after={"must_change_password": False},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return MessageResponse(message="Password changed")
