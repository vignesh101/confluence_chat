from __future__ import annotations

from typing import Iterable, List

import httpx
from openai import OpenAI

from config import Settings


def _build_httpx_client(cfg: Settings) -> httpx.Client:
    proxies = None
    if cfg.proxy_url:
        proxies = {"http://": cfg.proxy_url, "https://": cfg.proxy_url}
    return httpx.Client(
        proxies=proxies,
        verify=not cfg.disable_ssl,
        timeout=httpx.Timeout(60.0, connect=30.0, read=60.0),
    )


class LLMClient:
    def __init__(self, cfg: Settings):
        if not cfg.api_key:
            raise ValueError("API_KEY (LLM) is required")
        self.cfg = cfg
        self.client = OpenAI(
            base_url=cfg.openai_base_url or None,
            api_key=cfg.api_key,
            http_client=_build_httpx_client(cfg),
        )

    def embed(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        res = self.client.embeddings.create(model=self.cfg.embeddings_model_name, input=texts)
        return [d.embedding for d in res.data]

    def chat(self, messages: List[dict], temperature: float = 0.2) -> str:
        res = self.client.chat.completions.create(
            model=self.cfg.model_name,
            messages=messages,
            temperature=temperature,
        )
        return (res.choices[0].message.content or "").strip()
