from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.db.mongo import builds_col, projects_col

router = APIRouter(prefix="/files", tags=["files"])
logger = logging.getLogger(__name__)

_OUTPUTS_DIR = Path(__file__).parent.parent.parent / "outputs"

LANG_MAP = {
    "tf": "hcl",
    "py": "python",
    "ts": "typescript",
    "js": "javascript",
    "yaml": "yaml",
    "yml": "yaml",
    "json": "json",
    "sh": "bash",
}


def _ext_to_lang(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "text"
    return LANG_MAP.get(ext, ext)


def _safe_resolve(project_id: str, rel_path: str) -> Path:
    """Return the absolute path for rel_path inside outputs/{project_id}/.

    Raises HTTPException 400 if the path contains traversal components.
    """
    parts = Path(rel_path).parts
    if ".." in parts:
        raise HTTPException(status_code=400, detail="Path traversal is not allowed")
    return _OUTPUTS_DIR / project_id / rel_path


async def _require_project_owner(project_id: str, user: dict) -> dict:
    project = await projects_col().find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if str(project["owner_id"]) != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Forbidden")
    return project


# ---------------------------------------------------------------------------
# GET /files/{project_id}
# ---------------------------------------------------------------------------


def _list_files_sync(project_dir: Path) -> list[dict]:
    if not project_dir.exists():
        return []
    files = []
    for p in sorted(project_dir.rglob("*")):
        if p.is_file():
            rel = p.relative_to(project_dir).as_posix()
            files.append(
                {
                    "path": rel,
                    "name": p.name,
                    "lang": _ext_to_lang(p.name),
                }
            )
    return files


@router.get("/{project_id}")
async def list_files(
    project_id: str,
    user=Depends(get_current_user),
) -> dict:
    await _require_project_owner(project_id, user)
    project_dir = _OUTPUTS_DIR / project_id
    files = await asyncio.to_thread(_list_files_sync, project_dir)
    return {"files": files}


# ---------------------------------------------------------------------------
# GET /files/{project_id}/content
# ---------------------------------------------------------------------------


def _read_file_sync(path: Path) -> str:
    return path.read_text(encoding="utf-8")


@router.get("/{project_id}/content")
async def get_file_content(
    project_id: str,
    path: str = Query(..., description="Relative file path, e.g. terraform/main.tf"),
    user=Depends(get_current_user),
) -> dict:
    await _require_project_owner(project_id, user)
    dest = _safe_resolve(project_id, path)
    if not dest.exists() or not dest.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    content = await asyncio.to_thread(_read_file_sync, dest)
    return {
        "path": path,
        "content": content,
        "lang": _ext_to_lang(dest.name),
    }


# ---------------------------------------------------------------------------
# PUT /files/{project_id}/content
# ---------------------------------------------------------------------------


class FileWriteRequest(BaseModel):
    path: str
    content: str


def _write_file_sync(dest: Path, content: str) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(content, encoding="utf-8")


@router.put("/{project_id}/content")
async def update_file_content(
    project_id: str,
    body: FileWriteRequest,
    user=Depends(get_current_user),
) -> dict:
    await _require_project_owner(project_id, user)
    dest = _safe_resolve(project_id, body.path)

    await asyncio.to_thread(_write_file_sync, dest, body.content)

    build_doc = await builds_col().find_one(
        {"project_id": ObjectId(project_id)},
        sort=[("created_at", -1)],
    )
    if build_doc:
        update_fields: dict = {f"artifacts.{body.path}": body.content}
        generated_files: list[dict] = build_doc.get("generated_files", [])
        for i, f in enumerate(generated_files):
            if f.get("path") == body.path:
                update_fields[f"generated_files.{i}.content"] = body.content
                break
        await builds_col().update_one(
            {"_id": build_doc["_id"]},
            {"$set": update_fields},
        )
    else:
        logger.warning(
            "No build doc found for project %s when updating file %s",
            project_id,
            body.path,
        )

    return {"path": body.path, "saved": True}
