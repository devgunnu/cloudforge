from jinja2 import Environment, FileSystemLoader, select_autoescape
from pathlib import Path

_env = Environment(
    loader=FileSystemLoader(Path(__file__).parent),
    autoescape=select_autoescape(disabled_extensions=("j2",)),
    trim_blocks=True,
    lstrip_blocks=True,
)


def render_prompt(template_name: str, **kwargs) -> str:
    """Render a Jinja2 prompt template by name (without .jinja2 extension)."""
    return _env.get_template(f"{template_name}.jinja2").render(**kwargs)
