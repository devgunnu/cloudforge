from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from bson import ObjectId

from app.core.security import decode_token
from app.db.mongo import projects_col, users_col

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    payload = decode_token(token)
    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = await users_col().find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def require_project_owner(project_id: str, user: dict = Depends(get_current_user)) -> dict:
    project = await projects_col().find_one({"_id": ObjectId(project_id)})
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project.get("owner_id") != str(user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this project",
        )
    return project
