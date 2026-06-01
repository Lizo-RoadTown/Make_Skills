"""DEPRECATED shim. The real module lives at `core/skill_making/compiler.py`.

Kept here so existing imports (`from api.skill_compiler import ...`) keep
working during the staged MVP migration. Update callers to
`from core.skill_making.compiler import ...` and remove this file in a
later phase. Plan: `docs/plans/2026-06-01-mvp-migration.md`.
"""
from core.skill_making.compiler import compile_skill_to_tool  # noqa: F401
