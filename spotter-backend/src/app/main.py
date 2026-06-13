"""Application entry point."""

import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "app.settings")

import django  # noqa: E402

django.setup()


if __name__ == "__main__":
    import sys

    from django.core.management import execute_from_command_line

    host = os.getenv("HOST", "0.0.0.0")
    port = os.getenv("PORT", "8000")
    sys.argv = ["manage.py", "runserver", f"{host}:{port}"]
    execute_from_command_line(sys.argv)
