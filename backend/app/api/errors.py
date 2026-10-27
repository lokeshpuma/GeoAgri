"""
Shared API Error Handling Helper (PRD v3.1 §6 B5).
Logs full traceback internally with structured request ID and returns a safe, sanitized
error payload {"code": "INTERNAL", "request_id": "..."} without leaking internal str(e).
"""
import uuid
import logging
from fastapi import HTTPException

logger = logging.getLogger("geoagri.api")


def handle_internal_error(exc: Exception, operation: str = "operation") -> HTTPException:
    request_id = str(uuid.uuid4())[:8]
    logger.exception("Internal error during %s [ref: %s]: %s", operation, request_id, exc)
    return HTTPException(
        status_code=500,
        detail={
            "code": "INTERNAL",
            "message": f"Internal system error occurred during {operation} (ref: {request_id})",
            "request_id": request_id,
        },
    )
