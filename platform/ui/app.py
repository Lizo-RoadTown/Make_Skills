"""
Chainlit chat UI.

Talks HTTP to the api service (default http://api:8001 inside the compose
network, overridable via API_URL env). Persists thread_id per chainlit
session so a reload resumes the conversation.
"""
from __future__ import annotations

import json
import os
from typing import AsyncIterator

import chainlit as cl
import httpx

API_URL = os.environ.get("API_URL", "http://localhost:8001")


@cl.on_chat_start
async def on_chat_start():
    cl.user_session.set("thread_id", None)
    await cl.Message(
        content=(
            "Make_Skills agent ready. Ask anything — I'll route to the right "
            "skill or subagent. Type `/deep <question>` to force the deep-research topology."
        ),
    ).send()


@cl.on_message
async def on_message(message: cl.Message):
    thread_id = cl.user_session.get("thread_id")
    out = cl.Message(content="")
    await out.send()

    payload = {"message": message.content, "thread_id": thread_id}
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("POST", f"{API_URL}/chat/stream", json=payload) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                await cl.Message(content=f"API error {resp.status_code}: {body.decode()}").send()
                return
            async for line in _iter_sse(resp.aiter_lines()):
                event = line.get("event")
                if event == "thread":
                    cl.user_session.set("thread_id", line["thread_id"])
                elif event == "chunk":
                    await out.stream_token(line.get("data", ""))
                elif event == "error":
                    await cl.Message(content=f"Agent error: {line.get('detail')}").send()
                elif event == "done":
                    await out.update()


async def _iter_sse(lines: AsyncIterator[str]) -> AsyncIterator[dict]:
    async for raw in lines:
        if not raw or not raw.startswith("data:"):
            continue
        try:
            yield json.loads(raw[len("data:"):].strip())
        except json.JSONDecodeError:
            continue
