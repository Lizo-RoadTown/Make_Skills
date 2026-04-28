"""
FastAPI service wrapping the deepagents agent.

Exposes:
  GET  /healthz                     — liveness probe
  POST /chat                        — single-shot agent call (returns full response)
  POST /chat/stream                 — streamed agent call (SSE-style chunks)
  GET  /threads/{thread_id}/state   — fetch the persisted state for a thread

Each chat call must include a thread_id — that's the key the PostgresSaver
uses to persist and resume conversations across restarts.
"""
from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from api.agent import build_agent

log = logging.getLogger("api")
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Building deepagents agent...")
    app.state.agent = build_agent()
    log.info("Agent ready.")
    yield


app = FastAPI(title="Make_Skills agent API", lifespan=lifespan)


class ChatRequest(BaseModel):
    message: str
    thread_id: str | None = None


class ChatResponse(BaseModel):
    thread_id: str
    response: str


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Single-shot chat. Returns the full final response."""
    thread_id = req.thread_id or str(uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    try:
        result = await app.state.agent.ainvoke(
            {"messages": [{"role": "user", "content": req.message}]},
            config=config,
        )
    except Exception as e:
        log.exception("Agent invocation failed")
        raise HTTPException(status_code=500, detail=str(e))

    # The deepagents response shape may vary — adapt as needed.
    final = result["messages"][-1] if isinstance(result, dict) and "messages" in result else result
    response_text = getattr(final, "content", None) or str(final)
    return ChatResponse(thread_id=thread_id, response=response_text)


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """Streamed chat. Emits SSE-style JSON lines, one per chunk."""
    thread_id = req.thread_id or str(uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    async def gen():
        yield _sse({"event": "thread", "thread_id": thread_id})
        try:
            async for chunk in app.state.agent.astream(
                {"messages": [{"role": "user", "content": req.message}]},
                config=config,
                stream_mode="messages",
            ):
                yield _sse({"event": "chunk", "data": _serialize_chunk(chunk)})
        except Exception as e:
            log.exception("Stream failed")
            yield _sse({"event": "error", "detail": str(e)})
        yield _sse({"event": "done"})

    return StreamingResponse(gen(), media_type="text/event-stream")


@app.get("/threads/{thread_id}/state")
async def thread_state(thread_id: str):
    """Fetch the persisted state for a thread (debugging aid)."""
    config = {"configurable": {"thread_id": thread_id}}
    try:
        snapshot = await app.state.agent.aget_state(config)
    except Exception as e:
        log.exception("Could not fetch thread state")
        raise HTTPException(status_code=500, detail=str(e))
    return {"thread_id": thread_id, "values": snapshot.values}


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _serialize_chunk(chunk) -> str:
    """Best-effort: pull text out of whatever shape deepagents.astream yields."""
    if isinstance(chunk, tuple) and len(chunk) >= 1:
        chunk = chunk[0]
    content = getattr(chunk, "content", None)
    if content is not None:
        return content if isinstance(content, str) else json.dumps(content, default=str)
    return json.dumps(chunk, default=str)
