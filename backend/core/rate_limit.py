"""Application rate-limiting configuration."""

import math
import time

from limits import parse
from limits.storage import MemoryStorage
from limits.strategies import FixedWindowRateLimiter
from slowapi import Limiter
from slowapi.util import get_remote_address


RATE_LIMIT_READ = "60/minute"
RATE_LIMIT_SENSITIVE = "5/minute"
RATE_LIMIT_LOGIN = RATE_LIMIT_SENSITIVE
RATE_LIMIT_REGISTRATION = RATE_LIMIT_SENSITIVE
RATE_LIMIT_CREDENTIAL_CHANGE = RATE_LIMIT_SENSITIVE
RATE_LIMIT_ACCOUNT_PROVISIONING = "20/minute"
RATE_LIMIT_DIAGNOSTIC = "10/minute"
RATE_LIMIT_INCIDENT_SUBMISSION = "10/minute"
RATE_LIMIT_INCIDENT_MUTATION = "30/minute"
RATE_LIMIT_NOTE_CREATION = "30/minute"
RATE_LIMIT_PROTECTED_PAGE = "60/minute"
RATE_LIMIT_WEBSOCKET_CONNECT = "30/minute"
MAX_WEBSOCKET_CONNECTIONS_PER_USER = 5


limiter = Limiter(
    key_func=get_remote_address,
)


# Route decorators cannot reach middleware-served pages or WebSocket handshakes,
# so those requests are counted here using the same fixed-window strategy.
_manual_limit_storage = MemoryStorage()
_manual_limit_strategy = FixedWindowRateLimiter(_manual_limit_storage)


def check_manual_rate_limit(
    limit_value: str,
    scope: str,
    client_key: str,
) -> int | None:
    """Record one hit. Return None when allowed, or seconds until the window resets."""

    item = parse(limit_value)
    if _manual_limit_strategy.hit(item, scope, client_key):
        return None

    reset_time, _remaining = _manual_limit_strategy.get_window_stats(
        item,
        scope,
        client_key,
    )
    return max(1, math.ceil(reset_time - time.time()))


def reset_manual_rate_limits() -> None:
    """Clear the page and WebSocket counters (used by tests)."""

    _manual_limit_storage.reset()
