"""Transactional email via SMTP (§11).

Templates are Jinja2 files under ``app/templates/email/`` (HTML + plaintext per key), rendered
locally and sent through aiosmtplib. Sends are fire-and-forget from the caller's perspective —
the worker owns retries.
"""

from __future__ import annotations

from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from pathlib import Path
from typing import Any

import aiosmtplib
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.core.config import get_settings

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "email"

_env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(["html"]),
    trim_blocks=True,
    lstrip_blocks=True,
)


class EmailError(RuntimeError):
    pass


@dataclass(frozen=True)
class Template:
    key: str
    subject: str


# Subject lines are themselves tiny Jinja templates, rendered with the same params as the body.
TEMPLATES = {
    "welcome": Template("welcome", "Welcome to Rolewire, {{ company }}"),
    "application_received_applicant": Template(
        "application_received_applicant", "We received your application for {{ job_title }}"
    ),
    "application_received_tenant": Template(
        "application_received_tenant", "New application: {{ job_title }}"
    ),
    "renewal_reminder": Template("renewal_reminder", "Your Rolewire plan renews soon"),
    "payment_failed": Template("payment_failed", "We couldn't process your Rolewire payment"),
    "plan_upgraded": Template("plan_upgraded", "Your Rolewire plan is now {{ plan_name }}"),
}


def render(key: str, params: dict[str, Any] | None = None) -> tuple[str, str, str]:
    """Render a template's (subject, html, text) without sending. Raises for an unknown key."""
    template = TEMPLATES.get(key)
    if template is None:
        raise EmailError(f"unknown email template {key!r}")

    context = params or {}
    subject = _env.from_string(template.subject).render(**context)
    html_body = _env.get_template(f"{key}.html.j2").render(**context)
    text_body = _env.get_template(f"{key}.txt.j2").render(**context)
    return subject, html_body, text_body


async def send_template(
    *,
    key: str,
    to_email: str,
    params: dict[str, Any] | None = None,
    to_name: str | None = None,
) -> str:
    """Render the named template and send it over SMTP; returns the generated Message-ID."""
    settings = get_settings()
    if not settings.smtp_host:
        raise EmailError("smtp_host is not configured")

    subject, html_body, text_body = render(key, params)

    message = EmailMessage()
    message_id = make_msgid(domain="rolewire.com")
    message["Message-ID"] = message_id
    message["Subject"] = subject
    message["From"] = formataddr((settings.smtp_from_name, settings.smtp_from_email))
    message["To"] = formataddr((to_name, to_email)) if to_name else to_email
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_username or None,
            password=settings.smtp_password or None,
            start_tls=settings.smtp_use_tls,
        )
    except aiosmtplib.SMTPException as exc:
        raise EmailError(f"smtp send failed: {exc}") from exc

    return message_id
