"""
Compile a student-authored SKILL.md into a callable tool the deepagents
runtime can invoke. Per docs/proposals/pillar-1b-agent-runtime.md Decision 2:

  - Tool name = skill.name (short identifier).
  - Tool description = skill.description (what the LLM uses to decide
    when to reach for this skill — load-bearing).
  - Tool body wraps the user's task in a prompt that prepends skill.body_md
    as guidance, then invokes the model for execution.

This matches how the existing /skills/run endpoint composes prompts.
The difference: there, the dashboard explicitly picks a skill; here,
the agent's LLM picks among compiled tools by their descriptions.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from langchain_core.language_models.chat_models import BaseChatModel

    from api.runtime import StudentSkill

log = logging.getLogger("skill_compiler")


class _SkillInput(BaseModel):
    """The argument every compiled skill takes — the task to apply it to."""

    task: str = Field(
        ...,
        description=(
            "The user's task or question that this skill should be applied to. "
            "Pass the relevant context, question, or request as a single string."
        ),
    )


def compile_skill_to_tool(
    skill: "StudentSkill",
    model: "BaseChatModel",
) -> StructuredTool:
    """Turn a StudentSkill row into a langchain StructuredTool.

    The returned tool is async — when invoked by the agent's LLM, it
    runs a sub-call to the *same* model with the skill body prepended
    to the user's task. The skill body is treated as authoritative
    guidance for the sub-call.
    """
    skill_name = skill.name
    skill_description = skill.description
    skill_body = skill.body_md

    async def _run(task: str) -> str:
        """Apply this skill to a task and return the result."""
        prompt = (
            f"Apply the **{skill_name}** skill (defined below) to the user's "
            f"task. Follow the skill's structure — PROBE / DECIDE / ACT / REPORT — "
            f"as the authoritative guidance for how to handle this task.\n\n"
            f"---\n\n## Skill body\n\n{skill_body}\n\n---\n\n"
            f"## Task\n\n{task.strip()}"
        )
        try:
            result = await model.ainvoke(
                [{"role": "user", "content": prompt}]
            )
        except Exception as e:
            log.exception("skill %s sub-call failed", skill_name)
            return f"[skill {skill_name!r} failed: {e}]"
        # `content` may be a string or a list of content blocks. Extract text.
        content = getattr(result, "content", None)
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return "".join(
                block.get("text", "")
                for block in content
                if isinstance(block, dict) and block.get("type") == "text"
            )
        return str(result)

    # Sanitize the tool name — must be a valid identifier for most
    # langchain backends. Replace anything non-alphanumeric with underscore.
    sanitized_name = "".join(
        c if c.isalnum() or c == "_" else "_" for c in skill_name
    ) or "skill"

    return StructuredTool.from_function(
        coroutine=_run,
        name=sanitized_name,
        description=skill_description,
        args_schema=_SkillInput,
    )
