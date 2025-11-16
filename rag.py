from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

from config import Settings
from confluence_client import ConfluenceClient
from llm import LLMClient
from vector_store import ChromaVectorStore


@dataclass
class RetrievedChunk:
    id: str
    text: str
    metadata: Dict[str, Any]
    distance: float | None


def chunk_text(text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
    if chunk_size <= 0:
        return [text]
    chunks: List[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(n, start + chunk_size)
        chunk = text[start:end]
        chunks.append(chunk)
        if end == n:
            break
        start = max(end - chunk_overlap, start + 1)
    return chunks


class RAGPipeline:
    def __init__(self, cfg: Settings):
        self.cfg = cfg
        self.llm = LLMClient(cfg)
        self.store = ChromaVectorStore(cfg, self.llm)
        self.confluence = ConfluenceClient(cfg)

    def _ensure_pages_indexed(self, pages: List[Dict[str, Any]]):
        ids: List[str] = []
        texts: List[str] = []
        metas: List[Dict[str, Any]] = []
        for p in pages:
            pid = str(p["id"]) if not isinstance(p["id"], str) else p["id"]
            text, meta = self.confluence.get_page_text(pid)
            chunks = chunk_text(text, self.cfg.chunk_size, self.cfg.chunk_overlap)
            for idx, ch in enumerate(chunks):
                cid = f"{pid}:{idx}"
                ids.append(cid)
                texts.append(ch)
                metas.append({
                    "page_id": pid,
                    "chunk": idx,
                    "title": p.get("title") or meta.get("title"),
                    "space": p.get("space") or meta.get("space"),
                    "url": p.get("url"),
                })
        if ids:
            self.store.upsert(ids=ids, texts=texts, metadatas=metas)

    def retrieve(self, query: str) -> List[RetrievedChunk]:
        # Search Confluence first to discover candidate pages across all spaces
        pages = self.confluence.search_pages(query, limit=self.cfg.max_confluence_search_results)
        # Ensure their content is indexed in the vector store
        if pages:
            self._ensure_pages_indexed(pages)

        # Vector similarity search over all indexed content
        hits = self.store.query(query, k=self.cfg.top_k)
        return [RetrievedChunk(id=h["id"], text=h["text"], metadata=h["metadata"], distance=h.get("distance")) for h in hits]

    def build_prompt(self, query: str, history: List[Dict[str, str]], contexts: List[RetrievedChunk]) -> List[Dict[str, str]]:
        system = (
            "You are a helpful assistant that answers questions using provided Confluence context. "
            "Cite sources with their titles and URLs when relevant. If unsure, say you don't know."
        )
        ctx_block_lines: List[str] = []
        for i, c in enumerate(contexts, start=1):
            title = c.metadata.get("title") or "Untitled"
            url = c.metadata.get("url") or ""
            ctx_block_lines.append(f"[{i}] {title} - {url}\n{c.text}")
        ctx_block = "\n\n".join(ctx_block_lines) if ctx_block_lines else "(no context)"

        user_prompt = (
            "Answer the user question using the context.\n\n"
            f"Context:\n{ctx_block}\n\nQuestion: {query}\n"
        )
        messages: List[Dict[str, str]] = [{"role": "system", "content": system}]
        # Add brief summarized chat history for continuity
        for msg in history[-10:]:  # keep last 10 items
            role = msg.get("role") or ("user" if msg.get("is_user") else "assistant")
            messages.append({"role": role, "content": msg.get("content", "")})
        messages.append({"role": "user", "content": user_prompt})
        return messages

    def answer(self, query: str, history: List[Dict[str, str]]) -> Tuple[str, List[RetrievedChunk]]:
        contexts = self.retrieve(query)
        msgs = self.build_prompt(query, history, contexts)
        answer = self.llm.chat(msgs)
        return answer, contexts

