from collections.abc import Awaitable, Callable

from fastapi import Request
from fastapi.responses import PlainTextResponse, RedirectResponse, Response

from backend.core.security import SESSION_COOKIE, get_session_email
from backend.database import SessionLocal
from backend.services.users import get_user_profile


ROLE_WORKSPACES = {
    "/reporter/": "REPORTER",
    "/assigner/": "ASSIGNER",
    "/aptm/": "AID_PROVIDER_TEAM_MEMBER",
}


def get_authenticated_user(request: Request) -> dict[str, str | bool] | None:
    """Return the active session user, or None when the session is invalid."""
    email = get_session_email(request.cookies.get(SESSION_COOKIE))
    if not email:
        return None

    with SessionLocal() as db:
        return get_user_profile(db, email)


def get_required_role(path: str) -> str | None:
    """Find the role required by a workspace path."""
    for workspace, role in ROLE_WORKSPACES.items():
        if path.startswith(workspace):
            return role
    return None


def prevent_page_caching(response: Response) -> Response:
    """Prevent protected pages from being shown from the browser cache."""
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    return response


def protect_password_change_page(request: Request) -> Response | None:
    """Allow any authenticated user to change their password."""
    user = get_authenticated_user(request)
    if not user:
        return prevent_page_caching(RedirectResponse(url="/login", status_code=303))
    return None


def protect_workspace_page(request: Request, required_role: str) -> Response | None:
    """Enforce authentication, password setup, and role access for a workspace."""
    user = get_authenticated_user(request)
    if not user:
        return prevent_page_caching(RedirectResponse(url="/login", status_code=303))
    if user["must_change_password"]:
        return prevent_page_caching(RedirectResponse(url="/changePassword.html", status_code=303))
    if user["role"] != required_role:
        return prevent_page_caching(
            PlainTextResponse(
                "You are not authorized to access this workspace.",
                status_code=403,
            )
        )
    return None


async def protect_role_pages(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """Allow only the matching role to open HTML pages in each workspace."""
    path = request.url.path.lower()
    required_role = get_required_role(path)
    is_html_page = path.endswith(".html")
    is_password_change_page = path == "/changepassword.html"

    if is_password_change_page:
        protection_response = protect_password_change_page(request)
        if protection_response:
            return protection_response
    elif required_role is not None and is_html_page:
        protection_response = protect_workspace_page(request, required_role)
        if protection_response:
            return protection_response

    response = await call_next(request)
    if (required_role is not None or is_password_change_page) and is_html_page:
        return prevent_page_caching(response)
    return response
