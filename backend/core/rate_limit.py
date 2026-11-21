"""Application rate-limiting configuration."""

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


limiter = Limiter(
    key_func=get_remote_address,
)
