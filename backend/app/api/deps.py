from datetime import UTC, datetime

from fastapi import Cookie, Depends, HTTPException, Request, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_session_token
from app.db.session import get_db_session
from app.models.enums import UserRole
from app.models.session import Session
from app.models.user import User


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    session_token: str | None = Cookie(default=None, alias=settings.session_cookie_name),
) -> User:
    if not session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    hashed = hash_session_token(session_token)
    result = await db.execute(
        select(Session, User)
        .join(User, User.id == Session.user_id)
        .where(
            and_(
                Session.session_token_hash == hashed,
                Session.revoked_at.is_(None),
                Session.expires_at > datetime.now(UTC),
                User.is_active.is_(True),
            )
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    user = row[1]
    request.state.current_session = row[0]
    return user


def require_roles(*roles: UserRole):
    async def _require(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return _require
