"""Every declared email template must render — catches missing .j2 files or bad Jinja syntax."""

from __future__ import annotations

import pytest

from app.services import email

SAMPLE_PARAMS = {
    "company": "Acme Ltd",
    "job_title": "Backend Engineer",
    "plan_name": "Pro",
    "renew_url": "https://app.rolewire.io/billing",
    "period_end": "2026-09-01",
    "billing_url": "https://app.rolewire.io/billing",
}


@pytest.mark.parametrize("key", sorted(email.TEMPLATES))
def test_template_renders(key: str) -> None:
    subject, html_body, text_body = email.render(key, SAMPLE_PARAMS)
    assert subject and "{{" not in subject
    assert "<html" in html_body.lower()
    assert text_body.strip()


def test_render_rejects_unknown_key() -> None:
    with pytest.raises(email.EmailError):
        email.render("not-a-real-template")
