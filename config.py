from __future__ import annotations

import os
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load .env if present
load_dotenv()


class Settings(BaseModel):
    # LLM settings
    openai_base_url: str | None = Field(default_factory=lambda: os.getenv("OPENAI_BASE_URL") or os.getenv("OPENAPI_BASE_URL"))
    api_key: str | None = Field(default_factory=lambda: os.getenv("API_KEY") or os.getenv("OPENAI_API_KEY"))
    model_name: str = Field(default_factory=lambda: os.getenv("MODEL_NAME", "gpt-4o-mini"))
    embeddings_model_name: str = Field(default_factory=lambda: os.getenv("EMBEDDINGS_MODEL_NAME", "text-embedding-3-small"))

    # Networking
    proxy_url: str | None = Field(default_factory=lambda: os.getenv("PROXY_URL"))
    disable_ssl: bool = Field(default_factory=lambda: os.getenv("DISABLE_SSL", "false").lower() in {"1", "true", "yes", "on"})

    # Confluence settings
    confluence_base_url: str | None = Field(default_factory=lambda: os.getenv("CONFLUENCE_BASE_URL"))
    confluence_access_token: str | None = Field(default_factory=lambda: os.getenv("CONFLUENCE_ACCESS_TOKEN"))
    confluence_email: str | None = Field(default_factory=lambda: os.getenv("CONFLUENCE_EMAIL"))

    # Vector DB
    chroma_persist_dir: str = Field(default_factory=lambda: os.getenv("CHROMA_DIR", ".chroma"))

    # RAG params
    max_confluence_search_results: int = Field(default_factory=lambda: int(os.getenv("MAX_CONFLUENCE_RESULTS", "25")))
    chunk_size: int = Field(default_factory=lambda: int(os.getenv("CHUNK_SIZE", "1200")))
    chunk_overlap: int = Field(default_factory=lambda: int(os.getenv("CHUNK_OVERLAP", "150")))
    top_k: int = Field(default_factory=lambda: int(os.getenv("TOP_K", "6")))


def load_settings() -> Settings:
    return Settings()
