"""
LlamaParse smoke test.

Run this once to confirm:
  1. llama-parse is installed
  2. LLAMA_CLOUD_API_KEY is loaded into the environment (via VS Code's python.envFile setting)
  3. Your account is active and the API responds

How to run (no terminal needed):
  - Open this file in VS Code
  - Click the Run button (▶) in the top-right of the editor — or press F5
  - Watch the output panel at the bottom

Expected:  "✓ LlamaParse smoke test passed."
On failure: read the error — most often it's a missing `pip install llama-parse` or an unset env var.
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path


def main() -> int:
    print("=== LlamaParse smoke test ===\n")

    # 1. Env var present?
    key = os.environ.get("LLAMA_CLOUD_API_KEY", "")
    if not key:
        print("✗ LLAMA_CLOUD_API_KEY is not set in the environment.")
        print("  Check that platform/deploy/.env has a value for LLAMA_CLOUD_API_KEY,")
        print("  and that VS Code reloaded after .vscode/settings.json was added.")
        return 1
    if not key.startswith("llx-"):
        print(f"✗ LLAMA_CLOUD_API_KEY doesn't look like a LlamaCloud key (expected 'llx-...', got {key[:6]}...).")
        return 1
    print(f"✓ LLAMA_CLOUD_API_KEY loaded (starts with {key[:6]}...).\n")

    # 2. Package importable?
    try:
        from llama_parse import LlamaParse
    except ImportError:
        print("✗ llama-parse is not installed in this Python environment.")
        print("  Install with:    pip install llama-parse")
        print("  Or in VS Code:   open the Python interpreter picker, choose an env, then `pip install llama-parse` in the terminal.")
        return 1
    print("✓ llama-parse imported.\n")

    # 3. Trivial parse — generate a tiny one-page PDF on the fly so we don't need a fixture file.
    sample_pdf = _make_sample_pdf()
    if sample_pdf is None:
        print("⚠ Could not generate a sample PDF (reportlab not installed).")
        print("  Skipping live API call. Install reportlab with `pip install reportlab` to enable this step,")
        print("  OR drop any small PDF into the same folder as this script and rename it 'sample.pdf'.")
        local_sample = Path(__file__).parent / "sample.pdf"
        if not local_sample.exists():
            print("\n✓ Partial pass: env + import OK. Live API call skipped (no test PDF).")
            return 0
        sample_pdf = local_sample

    print(f"Sending {sample_pdf.name} to LlamaParse...")
    try:
        parser = LlamaParse(result_type="markdown")
        docs = parser.load_data(str(sample_pdf))
    except Exception as e:
        print(f"✗ LlamaParse API call failed: {e!r}")
        print("  Common causes: invalid key, free-tier quota exhausted, network blocked.")
        return 1

    if not docs or not docs[0].text:
        print("✗ LlamaParse returned an empty result. The API call worked but produced no content.")
        return 1

    snippet = docs[0].text.strip().splitlines()[0][:120]
    print(f"✓ LlamaParse returned content. First line: {snippet!r}\n")
    print("✓ LlamaParse smoke test passed.")
    return 0


def _make_sample_pdf() -> Path | None:
    """Return path to a tiny in-memory PDF, or None if reportlab isn't available."""
    try:
        from reportlab.pdfgen import canvas
    except ImportError:
        return None

    tmp = Path(tempfile.gettempdir()) / "llamaparse-smoke-test.pdf"
    c = canvas.Canvas(str(tmp))
    c.drawString(72, 720, "Make_Skills smoke test")
    c.drawString(72, 700, "If LlamaParse can read this line, the integration works.")
    c.save()
    return tmp


if __name__ == "__main__":
    sys.exit(main())
