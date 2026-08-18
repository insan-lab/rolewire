"""Validation of a public application payload against a job's configured questions.

The public API is unauthenticated, so this is the main guard against junk/oversized payloads
reaching the database. Validation is strict: unknown keys are rejected rather than silently
stored, so a tenant's exported answers always match the questions they configured.
"""

from __future__ import annotations

import re
from typing import Any

from app.models import JobQuestion

MAX_TEXT_LEN = 2_000
MAX_TEXTAREA_LEN = 20_000
MAX_ANSWER_KEYS = 100

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s.]+\.[^@\s]+$")
_PHONE_RE = re.compile(r"^\+?[0-9][0-9\s\-().]{4,31}$")
_TRUE = {"true", "yes", "1", "on"}
_FALSE = {"false", "no", "0", "off"}


class AnswerValidationError(ValueError):
    """Field-keyed validation failures for a submitted application."""

    def __init__(self, errors: dict[str, str]) -> None:
        self.errors = errors
        super().__init__("; ".join(f"{key}: {message}" for key, message in errors.items()))


def _coerce(question: JobQuestion, value: Any) -> Any:
    kind = question.question_type

    if kind in ("text", "email", "phone", "select"):
        if not isinstance(value, str):
            raise ValueError("expected a string")
        value = value.strip()
        if len(value) > MAX_TEXT_LEN:
            raise ValueError(f"must be at most {MAX_TEXT_LEN} characters")
        if kind == "email" and not _EMAIL_RE.match(value):
            raise ValueError("must be a valid email address")
        if kind == "phone" and not _PHONE_RE.match(value):
            raise ValueError("must be a valid phone number")
        if kind == "select" and value not in (question.options or []):
            raise ValueError("must be one of the configured options")
        return value

    if kind == "textarea":
        if not isinstance(value, str):
            raise ValueError("expected a string")
        value = value.strip()
        if len(value) > MAX_TEXTAREA_LEN:
            raise ValueError(f"must be at most {MAX_TEXTAREA_LEN} characters")
        return value

    if kind == "multiselect":
        if not isinstance(value, list):
            raise ValueError("expected a list")
        options = question.options or []
        cleaned: list[str] = []
        for item in value:
            if not isinstance(item, str) or item not in options:
                raise ValueError("all values must be among the configured options")
            if item not in cleaned:
                cleaned.append(item)
        return cleaned

    if kind == "number":
        if isinstance(value, bool):
            raise ValueError("expected a number")
        if isinstance(value, int | float):
            return value
        if isinstance(value, str):
            try:
                return float(value) if "." in value else int(value)
            except ValueError as exc:
                raise ValueError("expected a number") from exc
        raise ValueError("expected a number")

    if kind == "boolean":
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in _TRUE:
                return True
            if lowered in _FALSE:
                return False
        raise ValueError("expected a boolean")

    if kind == "file":
        # Files are uploaded out-of-band (§5.1 two-step flow); the answer is a storage reference.
        if not isinstance(value, str) or not value.strip():
            raise ValueError("expected an upload reference string")
        return value.strip()

    raise ValueError(f"unsupported question type '{kind}'")  # pragma: no cover - guarded by CHECK


def _is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, list | dict):
        return len(value) == 0
    return False


def validate_answers(
    questions: list[JobQuestion], answers: dict[str, Any]
) -> dict[str, Any]:
    """Return the cleaned answer set, or raise :class:`AnswerValidationError`."""
    if len(answers) > MAX_ANSWER_KEYS:
        raise AnswerValidationError({"answers": f"at most {MAX_ANSWER_KEYS} keys allowed"})

    known = {question.field_key: question for question in questions}
    errors: dict[str, str] = {}

    for key in answers:
        if key not in known:
            errors[key] = "unknown field_key for this job"

    cleaned: dict[str, Any] = {}
    for field_key, question in known.items():
        raw = answers.get(field_key)
        if _is_empty(raw):
            if question.required:
                errors[field_key] = "this field is required"
            continue
        try:
            cleaned[field_key] = _coerce(question, raw)
        except ValueError as exc:
            errors[field_key] = str(exc)

    if errors:
        raise AnswerValidationError(errors)
    return cleaned


def resume_ref_from_answers(
    questions: list[JobQuestion], cleaned: dict[str, Any]
) -> str | None:
    """Pick the first file answer as the canonical ``applications.resume_ref``."""
    for question in sorted(questions, key=lambda q: q.sort_order):
        if question.question_type == "file" and cleaned.get(question.field_key):
            return str(cleaned[question.field_key])
    return None
