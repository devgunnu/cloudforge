from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, StrictUndefined

_TEMPLATES_DIR = Path(__file__).parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    undefined=StrictUndefined,
    trim_blocks=True,
    lstrip_blocks=True,
    autoescape=False,  # prompts are plain text, not HTML
    keep_trailing_newline=True,
)

# Custom filters
_env.filters["tojson"] = lambda v, indent=None: json.dumps(v, indent=indent, default=str)
_env.filters["upper"] = str.upper
_env.filters["lower"] = str.lower


def render(template_name: str, **kwargs: Any) -> str:
    """
    Render a Jinja2 template from the templates/ directory.

    Args:
        template_name: filename relative to prompts/templates/ (e.g. "tf_generation_user.j2")
        **kwargs: variables injected into the template context

    Raises:
        TemplateNotFound: if the template file doesn't exist
        jinja2.UndefinedError: if a required variable is missing (StrictUndefined)
    """
    template = _env.get_template(template_name)
    return template.render(**kwargs).strip()
