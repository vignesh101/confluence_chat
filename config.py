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
    temperature: float = Field(default_factory=lambda: float(os.getenv("TEMPERATURE", "0.2")))

    # Networking
    proxy_url: str | None = Field(default_factory=lambda: os.getenv("PROXY_URL"))
    disable_ssl: bool = Field(default_factory=lambda: os.getenv("DISABLE_SSL", "false").lower() in {"1", "true", "yes", "on"})

    # Confluence settings
    confluence_base_url: str | None = Field(default_factory=lambda: os.getenv("CONFLUENCE_BASE_URL"))
    confluence_access_token: str | None = Field(default_factory=lambda: os.getenv("CONFLUENCE_ACCESS_TOKEN"))
    confluence_email: str | None = Field(default_factory=lambda: os.getenv("CONFLUENCE_EMAIL"))
    # Optional username for Basic auth (useful for Confluence Data Center)
    confluence_username: str | None = Field(default_factory=lambda: os.getenv("CONFLUENCE_USERNAME"))
    # Optional filters
    confluence_spaces: list[str] | None = Field(default_factory=lambda: [s.strip() for s in os.getenv("CONFLUENCE_SPACES", "").split(",") if s.strip()] or None)
    confluence_labels: list[str] | None = Field(default_factory=lambda: [s.strip() for s in os.getenv("CONFLUENCE_LABELS", "").split(",") if s.strip()] or None)

    # Vector store
    # Prefer FAISS. If FAISS_DIR not set, fallback to CHROMA_DIR for backward-compatible path.
    faiss_dir: str = Field(default_factory=lambda: os.getenv("FAISS_DIR", os.getenv("CHROMA_DIR", ".faiss")))

    # RAG params
    max_confluence_search_results: int = Field(default_factory=lambda: int(os.getenv("MAX_CONFLUENCE_RESULTS", "30")))
    chunk_size: int = Field(default_factory=lambda: int(os.getenv("CHUNK_SIZE", "1500")))
    chunk_overlap: int = Field(default_factory=lambda: int(os.getenv("CHUNK_OVERLAP", "200")))
    top_k: int = Field(default_factory=lambda: int(os.getenv("TOP_K", "8")))
    max_chunks_per_page: int = Field(default_factory=lambda: int(os.getenv("MAX_CHUNKS_PER_PAGE", "3")))
    max_context_chars: int = Field(default_factory=lambda: int(os.getenv("MAX_CONTEXT_CHARS", "16000")))
    use_multi_query: bool = Field(default_factory=lambda: os.getenv("USE_MULTI_QUERY", "true").lower() in {"1", "true", "yes", "on"})
    num_query_variants: int = Field(default_factory=lambda: int(os.getenv("NUM_QUERY_VARIANTS", "3")))
    retrieval_pool_factor: int = Field(default_factory=lambda: int(os.getenv("RETRIEVAL_POOL_FACTOR", "5")))
    mmr_lambda: float = Field(default_factory=lambda: float(os.getenv("MMR_LAMBDA", "0.6")))
    max_history_turns: int = Field(default_factory=lambda: int(os.getenv("MAX_HISTORY_TURNS", "10")))
    show_query_details: bool = Field(default_factory=lambda: os.getenv("SHOW_QUERY_DETAILS", "false").lower() in {"1", "true", "yes", "on"})


def load_settings() -> Settings:
    return Settings()


# Global settings instance for convenience
settings = load_settings()
