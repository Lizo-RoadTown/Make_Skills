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
import asyncio
import os
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from api.agent import build_agent
from api.memory.lance import count as memory_count
from api.memory.lance import list_records as memory_list
from api.memory.lance import search as memory_search
from api.memory.recorder import record_turn
from api.roadmap.file import (
    VALID_STATUSES,
    append_under_section,
    apply_status_update,
    read_roadmap,
    write_roadmap,
)
from api import fileviewer, observability

log = logging.getLogger("api")
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Building deepagents agent...")
    app.state.agent = await build_agent()
    log.info("Agent ready.")
    yield


app = FastAPI(title="Make_Skills agent API", lifespan=lifespan)

# Allow the Vercel-hosted UI (humancensys.com), local Next.js dev, and Vercel
# preview deploys to call this API from the browser.
# CORS_EXTRA_ORIGINS env var can add more (comma-separated) without code change.
_default_origins = [
    "http://localhost:3000",
    "https://humancensys.com",
    "https://www.humancensys.com",
]
_extra_origins = [
    o.strip() for o in os.environ.get("CORS_EXTRA_ORIGINS", "").split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_default_origins + _extra_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",  # any vercel preview
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
async def chat(req: ChatRequest, background: BackgroundTasks):
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

    # Fire-and-forget: extract memory records from this turn after the response is sent.
    background.add_task(record_turn, thread_id, req.message, response_text)

    return ChatResponse(thread_id=thread_id, response=response_text)


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """Streamed chat. Emits SSE-style JSON lines, one per chunk."""
    thread_id = req.thread_id or str(uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    async def gen():
        yield _sse({"event": "thread", "thread_id": thread_id})
        accumulated = []
        try:
            async for chunk in app.state.agent.astream(
                {"messages": [{"role": "user", "content": req.message}]},
                config=config,
                stream_mode="messages",
            ):
                serialized = _serialize_chunk(chunk)
                accumulated.append(serialized)
                yield _sse({"event": "chunk", "data": serialized})
        except Exception as e:
            log.exception("Stream failed")
            yield _sse({"event": "error", "detail": str(e)})
        yield _sse({"event": "done"})

        # Fire-and-forget memory extraction. Run as a detached task so we don't
        # block this generator's cleanup.
        full_response = "".join(accumulated)
        if full_response.strip():
            asyncio.create_task(record_turn(thread_id, req.message, full_response))

    return StreamingResponse(gen(), media_type="text/event-stream")


# ----- Memory endpoints -----


class MemorySearchRequest(BaseModel):
    query: str
    limit: int = Field(default=10, ge=1, le=50)
    record_type: str | None = None
    project_tag: str | None = None


@app.post("/memory/search")
async def memory_search_endpoint(req: MemorySearchRequest):
    """Semantic search across memory. Returns records ranked by relevance."""
    try:
        rows = memory_search(
            query=req.query,
            limit=req.limit,
            record_type=req.record_type,
            project_tags=[req.project_tag] if req.project_tag else None,
        )
        return {"query": req.query, "count": len(rows), "results": rows}
    except Exception as e:
        log.exception("Memory search failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/memory/records")
async def memory_records_endpoint(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    record_type: str | None = None,
    project_tag: str | None = None,
):
    """List records, newest first. Non-semantic; for browsing."""
    try:
        rows = memory_list(
            limit=limit,
            offset=offset,
            record_type=record_type,
            project_tag=project_tag,
        )
        return {"count": len(rows), "results": rows}
    except Exception as e:
        log.exception("Memory list failed")
        raise HTTPException(status_code=500, detail=str(e))


# ----- File viewers (docs + skills) -----


@app.get("/docs/tree")
async def docs_tree_endpoint():
    """Walk docs/ and return a nested tree of markdown files."""
    try:
        return {"tree": fileviewer.docs_tree()}
    except Exception as e:
        log.exception("docs tree failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/docs/file")
async def docs_file_endpoint(path: str = Query(..., description="Relative path under docs/")):
    """Return the markdown content of one doc file."""
    try:
        return {"path": path, "content": fileviewer.docs_file(path)}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        log.exception("docs file failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/skills/list")
async def skills_list_endpoint():
    """List skills with their name + description from SKILL.md frontmatter."""
    try:
        return {"skills": fileviewer.skills_tree()}
    except Exception as e:
        log.exception("skills list failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/skills/file")
async def skills_file_endpoint(path: str = Query(..., description="Relative path under skills/")):
    """Return the markdown content of a SKILL.md or skill resource."""
    try:
        return {"path": path, "content": fileviewer.skills_file(path)}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        log.exception("skills file failed")
        raise HTTPException(status_code=500, detail=str(e))


# ----- Memory stats / search / ingest -----


@app.get("/memory/stats")
async def memory_stats_endpoint():
    """Quick stats — total record count, by type."""
    try:
        return {"total": memory_count()}
    except Exception as e:
        log.exception("Memory stats failed")
        raise HTTPException(status_code=500, detail=str(e))


class IngestRequest(BaseModel):
    user_message: str
    agent_response: str
    source_thread_id: str = "backfill"


# ----- Observability endpoints -----


@app.get("/observability/summary")
async def observability_summary_endpoint():
    """Top-of-dashboard KPIs."""
    try:
        return observability.summary()
    except Exception as e:
        log.exception("observability summary failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/observability/records-by-type")
async def observability_records_by_type_endpoint():
    return {"data": observability.memory_records_by_type()}


@app.get("/observability/records-by-day")
async def observability_records_by_day_endpoint(days: int = Query(30, ge=1, le=365)):
    return {"data": observability.memory_records_by_day(days)}


@app.get("/observability/records-by-tag")
async def observability_records_by_tag_endpoint(top: int = Query(10, ge=1, le=50)):
    return {"data": observability.memory_records_by_tag(top)}


@app.get("/observability/recent")
async def observability_recent_endpoint(limit: int = Query(10, ge=1, le=50)):
    return {"data": observability.recent_records(limit)}


@app.get("/observability/threads-by-day")
async def observability_threads_by_day_endpoint(days: int = Query(30, ge=1, le=365)):
    return {"data": observability.threads_by_day(days)}


# ----- Roadmap endpoints -----


@app.get("/roadmap")
async def roadmap_get_endpoint():
    """Return the raw markdown of ROADMAP.md."""
    return {"content": read_roadmap()}


class RoadmapStatusUpdate(BaseModel):
    item_title: str
    new_status: str
    why: str | None = None


@app.post("/roadmap/update_item")
async def roadmap_update_item_endpoint(req: RoadmapStatusUpdate):
    """Update a roadmap item's status by matching its first-column title."""
    if req.new_status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"invalid status {req.new_status!r}; must be one of {sorted(VALID_STATUSES)}",
        )
    res = apply_status_update(req.item_title, req.new_status, req.why)
    if not res["ok"]:
        raise HTTPException(status_code=404, detail=res["error"])
    return res


class RoadmapAppendItem(BaseModel):
    section_heading: str
    item_title: str
    status: str
    why: str | None = None


@app.post("/roadmap/add_item")
async def roadmap_add_item_endpoint(req: RoadmapAppendItem):
    """Append a new row under the given roadmap section."""
    if req.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"invalid status {req.status!r}")
    from api.roadmap.file import STATUS_EMOJI

    block = f"| {req.item_title} | {STATUS_EMOJI[req.status]} | {req.why or ''} |"
    res = append_under_section(req.section_heading, block)
    if not res["ok"]:
        raise HTTPException(status_code=404, detail=res["error"])
    return res


class RoadmapOverwrite(BaseModel):
    content: str


@app.post("/roadmap/overwrite")
async def roadmap_overwrite_endpoint(req: RoadmapOverwrite):
    """Replace the entire ROADMAP.md content. Used by the human-edit path
    in the UI when she wants to make broader changes than table rows."""
    write_roadmap(req.content)
    return {"ok": True, "bytes": len(req.content)}


# ----- Memory ingest -----


@app.post("/memory/ingest")
async def memory_ingest_endpoint(req: IngestRequest):
    """Run the recorder on a single (user, agent) pair without going through the
    chat loop. Used by backfill scripts that ingest historical transcripts
    (Claude Code sessions, Copilot logs, etc.) into the same memory store the
    live agent uses.
    """
    try:
        count_inserted = await record_turn(
            req.source_thread_id, req.user_message, req.agent_response
        )
        return {"ingested": count_inserted}
    except Exception as e:
        log.exception("Memory ingest failed")
        raise HTTPException(status_code=500, detail=str(e))


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
