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


async def protect_role_pages(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """Allow only the matching role to open HTML pages in each workspace."""
    path = request.url.path.lower()
    required_role = next(
        (role for workspace, role in ROLE_WORKSPACES.items() if path.startswith(workspace)),
        None,
    )

    if required_role and path.endswith(".html"):
        email = get_session_email(request.cookies.get(SESSION_COOKIE))
        if not email:
            return RedirectResponse(url="/login", status_code=303)

        with SessionLocal() as db:
            user = get_user_profile(db, email)

        if not user:
            return RedirectResponse(url="/login", status_code=303)
        if user["role"] != required_role:
            return PlainTextResponse(
                "You are not authorized to access this workspace.",
                status_code=403,
            )

    return await call_next(request)
