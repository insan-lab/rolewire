"""Answer validation against a job's question set."""

from __future__ import annotations

import uuid

import pytest

from app.models import JobQuestion
from app.services.answers import (
    AnswerValidationError,
    resume_ref_from_answers,
    validate_answers,
)


def question(**kwargs) -> JobQuestion:
    defaults = {
        "id": uuid.uuid4(),
        "job_id": uuid.uuid4(),
        "tenant_id": uuid.uuid4(),
        "label": "Label",
        "required": True,
        "sort_order": 0,
        "options": None,
    }
    return JobQuestion(**{**defaults, **kwargs})


def test_accepts_and_coerces_valid_answers() -> None:
    questions = [
        question(field_key="full_name", question_type="text"),
        question(field_key="years", question_type="number"),
        question(field_key="remote_ok", question_type="boolean"),
        question(field_key="email", question_type="email"),
        question(field_key="phone", question_type="phone"),
        question(
            field_key="notice", question_type="select", options=["Immediate", "1 month"]
        ),
        question(field_key="stack", question_type="multiselect", options=["py", "ts", "go"]),
    ]
    cleaned = validate_answers(
        questions,
        {
            "full_name": "  Jane Doe  ",
            "years": "4",
            "remote_ok": "yes",
            "email": "jane@example.com",
            "phone": "+8801711223344",
            "notice": "1 month",
            "stack": ["py", "ts", "py"],
        },
    )
    assert cleaned["full_name"] == "Jane Doe"
    assert cleaned["years"] == 4
    assert cleaned["remote_ok"] is True
    assert cleaned["stack"] == ["py", "ts"]


def test_missing_required_field_is_rejected() -> None:
    questions = [question(field_key="full_name", question_type="text")]
    with pytest.raises(AnswerValidationError) as exc_info:
        validate_answers(questions, {"full_name": "   "})
    assert exc_info.value.errors == {"full_name": "this field is required"}


def test_optional_field_may_be_omitted() -> None:
    questions = [
        question(field_key="full_name", question_type="text"),
        question(field_key="portfolio", question_type="text", required=False),
    ]
    cleaned = validate_answers(questions, {"full_name": "Jane"})
    assert cleaned == {"full_name": "Jane"}


def test_unknown_field_key_is_rejected() -> None:
    questions = [question(field_key="full_name", question_type="text")]
    with pytest.raises(AnswerValidationError) as exc_info:
        validate_answers(questions, {"full_name": "Jane", "salary_expectation": "lots"})
    assert "salary_expectation" in exc_info.value.errors


def test_select_value_must_match_options() -> None:
    questions = [question(field_key="notice", question_type="select", options=["Immediate"])]
    with pytest.raises(AnswerValidationError) as exc_info:
        validate_answers(questions, {"notice": "Next year"})
    assert exc_info.value.errors["notice"].startswith("must be one of")


@pytest.mark.parametrize(
    ("kind", "value"),
    [
        ("email", "not-an-email"),
        ("phone", "abc"),
        ("number", "twelve"),
        ("boolean", "maybe"),
        ("multiselect", "py"),
    ],
)
def test_type_violations_are_reported(kind: str, value: object) -> None:
    options = ["py", "ts"] if kind == "multiselect" else None
    questions = [question(field_key="field", question_type=kind, options=options)]
    with pytest.raises(AnswerValidationError):
        validate_answers(questions, {"field": value})


def test_oversized_text_is_rejected() -> None:
    questions = [question(field_key="bio", question_type="text")]
    with pytest.raises(AnswerValidationError):
        validate_answers(questions, {"bio": "x" * 5000})


def test_resume_ref_picks_first_file_answer() -> None:
    questions = [
        question(field_key="cover", question_type="file", sort_order=1, required=False),
        question(field_key="resume", question_type="file", sort_order=0, required=False),
    ]
    cleaned = validate_answers(
        questions, {"resume": "s3://bucket/resume.pdf", "cover": "s3://bucket/cover.pdf"}
    )
    assert resume_ref_from_answers(questions, cleaned) == "s3://bucket/resume.pdf"
