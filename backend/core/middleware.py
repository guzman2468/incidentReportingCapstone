from collections.abc import Awaitable, Callable

from fastapi import Request
from fastapi.responses import PlainTextResponse, RedirectResponse, Response
from slowapi.util import get_remote_address

from backend.core.rate_limit import RATE_LIMIT_PROTECTED_PAGE, check_manual_rate_limit
from backend.core.security import SESSION_COOKIE, get_session_email
from backend.database import SessionLocal
from backend.services.users import get_user_profile


ROLE_WORKSPACES = {
    "/reporter/": "REPORTER",
    "/assigner/": "ASSIGNER",
    "/aptm/": "AID_PROVIDER_TEAM_MEMBER",
    "/admin/": "ADMIN",
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


def reject_rate_limited_page(request: Request) -> Response | None:
    """Return a 429 response when a client requests protected pages too quickly."""
    retry_after = check_manual_rate_limit(
        RATE_LIMIT_PROTECTED_PAGE,
        "protected-page",
        get_remote_address(request),
    )
    if retry_after is None:
        return None

    return prevent_page_caching(
        PlainTextResponse(
            "Too many page requests. Please wait and try again.",
            status_code=429,
            headers={"Retry-After": str(retry_after)},
        )
    )


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
    is_protected_page = is_password_change_page or (
        required_role is not None and is_html_page
    )

    # Check the limit before the session lookup so floods never reach the database.
    if is_protected_page:
        rate_limit_response = reject_rate_limited_page(request)
        if rate_limit_response:
            return rate_limit_response

    if is_password_change_page:
        protection_response = protect_password_change_page(request)
        if protection_response:
            return protection_response
    elif required_role is not None and is_html_page:
        protection_response = protect_workspace_page(request, required_role)
        if protection_response:
            return protection_response

    response = await call_next(request)
    if is_protected_page:
        return prevent_page_caching(response)
    return response
