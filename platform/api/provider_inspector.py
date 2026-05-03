"""
Read-only inspector over model_registry providers — surfaces them as
pickable cards in the agent-builder wizard. For each provider we report
its key-presence (so the UI can show "ready" vs "needs API key"), the
recommended starter model, and a one-line description framed for a
student picking a "brain" for the first time.
"""
from __future__ import annotations

import os

from api.model_registry import RECOMMENDED_STARTERS, supported_providers


# Env vars that indicate a provider is usable in the current process.
# Multiple acceptable names per provider — first hit wins.
_KEY_ENVS: dict[str, list[str]] = {
    "anthropic": ["ANTHROPIC_API_KEY"],
    "openai": ["OPENAI_API_KEY"],
    "google": ["GOOGLE_API_KEY", "GEMINI_API_KEY"],
    "huggingface": ["HUGGINGFACEHUB_API_TOKEN", "HF_TOKEN"],
    "together": ["TOGETHER_API_KEY"],
    "groq": ["GROQ_API_KEY"],
    "ollama": [],  # local; no key required
}


# One-line, student-facing descriptions. Plain language, not marketing copy.
# These appear under the provider name on the wizard's "pick a brain" step.
_DESCRIPTIONS: dict[str, str] = {
    "anthropic": "Claude — strong at long reasoning and following nuanced instructions. Paid API.",
    "openai": "GPT — broadly capable, well-known, fast. Paid API.",
    "google": "Gemini — large free tier, fast, strong on multimodal tasks. Free + paid.",
    "huggingface": "Open-weight models via HF Inference Providers. Free tier; pick from many.",
    "together": "Hosted open-weight models (Llama, Mixtral, etc.). Pay-as-you-go.",
    "groq": "Hosted open-weight models on custom hardware — very fast inference. Free tier.",
    "ollama": "Run open-weight models locally on your own machine. No API key, no cost.",
}


# Whether a provider needs network reach to a paid API. Used by the UI to
# group "free to try" vs "bring your own key" choices.
_TIER: dict[str, str] = {
    "anthropic": "paid",
    "openai": "paid",
    "google": "free-tier",
    "huggingface": "free-tier",
    "together": "paid",
    "groq": "free-tier",
    "ollama": "local",
}


def list_providers() -> list[dict]:
    """Return one entry per supported model provider for the wizard."""
    out = []
    for slug in supported_providers():
        envs = _KEY_ENVS.get(slug, [])
        ready = (not envs) or any(os.environ.get(e) for e in envs)
        out.append(
            {
                "slug": slug,
                "label": slug.capitalize(),
                "description": _DESCRIPTIONS.get(slug, ""),
                "tier": _TIER.get(slug, "paid"),
                "starter_model": RECOMMENDED_STARTERS.get(slug),
                "key_env_vars": envs,
                "ready": ready,
            }
        )
    return out
