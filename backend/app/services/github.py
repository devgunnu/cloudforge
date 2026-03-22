from __future__ import annotations

import base64
from typing import Optional

import httpx

GITHUB_API = "https://api.github.com"


async def list_repos(token: str) -> list[dict]:
    """Returns list of {full_name, default_branch, private}"""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GITHUB_API}/user/repos",
            headers={
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github.v3+json",
            },
            params={"per_page": 100, "sort": "updated"},
        )
        resp.raise_for_status()
        return [
            {
                "full_name": r["full_name"],
                "default_branch": r["default_branch"],
                "private": r["private"],
            }
            for r in resp.json()
        ]


async def get_default_branch(token: str, owner: str, repo: str) -> str:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}",
            headers={"Authorization": f"token {token}"},
        )
        resp.raise_for_status()
        return resp.json()["default_branch"]


async def _get_ref_sha(
    client: httpx.AsyncClient, token: str, owner: str, repo: str, branch: str
) -> str:
    resp = await client.get(
        f"{GITHUB_API}/repos/{owner}/{repo}/git/ref/heads/{branch}",
        headers={"Authorization": f"token {token}"},
    )
    resp.raise_for_status()
    return resp.json()["object"]["sha"]


async def _create_blob(
    client: httpx.AsyncClient, token: str, owner: str, repo: str, content: str
) -> str:
    resp = await client.post(
        f"{GITHUB_API}/repos/{owner}/{repo}/git/blobs",
        json={
            "content": base64.b64encode(content.encode()).decode(),
            "encoding": "base64",
        },
        headers={"Authorization": f"token {token}"},
    )
    resp.raise_for_status()
    return resp.json()["sha"]


async def _create_tree(
    client: httpx.AsyncClient,
    token: str,
    owner: str,
    repo: str,
    base_tree_sha: str,
    files: list[dict],
) -> str:
    """files: list of {path: str, content: str}"""
    tree_items = []
    for f in files:
        blob_sha = await _create_blob(client, token, owner, repo, f["content"])
        tree_items.append(
            {"path": f["path"], "mode": "100644", "type": "blob", "sha": blob_sha}
        )

    resp = await client.post(
        f"{GITHUB_API}/repos/{owner}/{repo}/git/trees",
        json={"base_tree": base_tree_sha, "tree": tree_items},
        headers={"Authorization": f"token {token}"},
    )
    resp.raise_for_status()
    return resp.json()["sha"]


async def _create_commit(
    client: httpx.AsyncClient,
    token: str,
    owner: str,
    repo: str,
    tree_sha: str,
    parent_sha: str,
    message: str,
) -> str:
    resp = await client.post(
        f"{GITHUB_API}/repos/{owner}/{repo}/git/commits",
        json={"message": message, "tree": tree_sha, "parents": [parent_sha]},
        headers={"Authorization": f"token {token}"},
    )
    resp.raise_for_status()
    return resp.json()["sha"]


async def _update_ref(
    client: httpx.AsyncClient,
    token: str,
    owner: str,
    repo: str,
    branch: str,
    commit_sha: str,
) -> None:
    resp = await client.patch(
        f"{GITHUB_API}/repos/{owner}/{repo}/git/refs/heads/{branch}",
        json={"sha": commit_sha, "force": False},
        headers={"Authorization": f"token {token}"},
    )
    resp.raise_for_status()


async def commit_files(
    token: str,
    owner: str,
    repo: str,
    files: list[dict],
    message: str,
    branch: Optional[str] = None,
) -> str:
    """
    files: list of {path: str, content: str}
    Returns commit_sha.
    """
    async with httpx.AsyncClient() as client:
        if branch is None:
            branch = await get_default_branch(token, owner, repo)

        parent_sha = await _get_ref_sha(client, token, owner, repo, branch)

        commit_resp = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/git/commits/{parent_sha}",
            headers={"Authorization": f"token {token}"},
        )
        commit_resp.raise_for_status()
        base_tree_sha = commit_resp.json()["tree"]["sha"]

        tree_sha = await _create_tree(client, token, owner, repo, base_tree_sha, files)
        commit_sha = await _create_commit(
            client, token, owner, repo, tree_sha, parent_sha, message
        )
        await _update_ref(client, token, owner, repo, branch, commit_sha)
        return commit_sha
