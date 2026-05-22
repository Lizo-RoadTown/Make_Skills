# Memory MCP — running locally

How to run the LanceDB-backed memory MCP server on your machine and wire it into Claude Code.

Status: **Phase 1** — local-only, no auth, single-tenant. Hosted-mode with JWT auth lands in Phase 3 of the proposal at [docs/proposals/lancedb-memory-mcp.md](../proposals/lancedb-memory-mcp.md).

## Prerequisites

- The Make_Skills platform deps installed (`pip install -r platform/requirements.txt`)
- LanceDB data directory exists or is writable. Defaults to `/data/memory`; override with the `MEMORY_DATA_DIR` env var if you want it under your home directory while testing.

## Run the smoke tests first

Confirm the six tools work end-to-end before wiring into Claude Code:

```bash
# From the repo root, inside the api container (or with platform deps active locally)
MEMORY_DATA_DIR=./local-memory-data python -m pytest platform/tests/test_memory_mcp.py -v
```

Expected: all nine tests pass. They cover write, read, upsert, list-with-filter, soft-delete, semantic search, recall, and invalid-type error.

If a test fails, fix the underlying issue (likely a LanceDB schema or fastembed-init problem) before proceeding — the MCP server is a thin wrapper, so failures here surface real LanceDB issues, not server bugs.

## Run the server directly (for debugging)

The server speaks stdio, so running it directly is mostly useful for verifying it doesn't crash on startup:

```bash
MEMORY_DATA_DIR=./local-memory-data python -m platform.api.memory.mcp_server
```

You'll see the server block waiting for an MCP client to connect over stdin. Send EOF (Ctrl-Z + Enter on Windows, Ctrl-D on Unix) to exit.

For real interactive use, wire it into Claude Code below.

## Wire into Claude Code

Add an MCP server entry to your Claude Code config. The config file lives at:

- Windows: `C:\Users\Liz\.claude\mcp.json` (user-scope) or `<project>/.claude/mcp.json` (project-scope)
- macOS / Linux: `~/.claude/mcp.json` or `<project>/.claude/mcp.json`

Entry:

```json
{
  "mcpServers": {
    "memory": {
      "command": "python",
      "args": ["-m", "platform.api.memory.mcp_server"],
      "cwd": "C:\\Users\\Liz\\Make_Skills",
      "env": {
        "MEMORY_DATA_DIR": "C:\\Users\\Liz\\Make_Skills\\local-memory-data"
      }
    }
  }
}
```

Adjust `cwd` to wherever you cloned Make_Skills. Adjust `MEMORY_DATA_DIR` to wherever you want the LanceDB files to live (this directory will be created if it doesn't exist).

After saving, restart Claude Code. The six tools (`memory_read`, `memory_list`, `memory_write`, `memory_delete`, `memory_search`, `memory_recall`) will appear in the available tools list.

## Verify it's working

In a Claude Code session:

```
Use memory_write to save a memory named "test_handshake" with content "If this read-back works, the MCP server is live." and record_type "project".
```

Then:

```
Use memory_read to fetch the memory named "test_handshake".
```

You should get the content back.

Cleanup:

```
Use memory_delete on the memory named "test_handshake".
```

## What's NOT in Phase 1

- **No auth.** Anyone with shell access to the machine running the server has full read/write to the memory store. Acceptable for the single-user self-host use case; not acceptable for hosted mode.
- **No multi-tenant.** All operations are scoped to `tenant_id="default"`. Phase 3 adds JWT-derived tenant_id resolution.
- **No HTTP/SSE transport.** Phase 1 is stdio-only. Phase 3 adds the HTTP endpoint at humancensys.com/mcp.
- **No frontmatter parsing.** The MCP server treats memory content as opaque text. If you write a memory with YAML frontmatter at the top of content, it's stored as-is — the protocol's frontmatter convention is recoverable from content but not parsed.
- **No `MEMORY.md` index.** The file-protocol's `MEMORY.md` index doesn't exist in the LanceDB-backed store; `memory_list` is its functional replacement. If you want the index file on disk too, that's the local sync shim (Phase 2).
- **No cross-machine sync.** Phase 1 stores everything in one local data directory. To share across machines, you need either Phase 3 (hosted MCP endpoint) or a manual sync of the data directory.

## Troubleshooting

**`ModuleNotFoundError: No module named 'mcp'`** — install the SDK: `pip install mcp>=1.0` (or run `pip install -r platform/requirements.txt`).

**LanceDB schema-mismatch errors on first run** — usually means a stale data directory from a prior incompatible schema. Delete `MEMORY_DATA_DIR` and let it recreate.

**fastembed downloads a model on first call** — that's expected. The ~80MB BAAI/bge-small-en-v1.5 model caches under `~/.cache/fastembed/` after the first embedding.

**Claude Code says the MCP server "failed to start"** — run the server directly (`python -m platform.api.memory.mcp_server`) and check the stderr output. Most often a missing dep or a permission issue on `MEMORY_DATA_DIR`.

## Next steps (after Phase 1 ships)

- **Phase 2:** the local sync shim — daemon that mirrors MCP-backed memory to the file directory at `~/.claude/projects/<key>/memory/`. Lets the existing file-protocol coexist with the MCP store.
- **Phase 3:** hosted-mode auth — JWT validation, multi-tenant, HTTP/SSE transport, deployed to humancensys.com/mcp.

See [docs/proposals/lancedb-memory-mcp.md](../proposals/lancedb-memory-mcp.md) for the full plan.
