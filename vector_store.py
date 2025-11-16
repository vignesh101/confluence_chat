from __future__ import annotations

from typing import Any, Dict, Iterable, List, Tuple

import chromadb
from chromadb.utils import embedding_functions

from config import Settings
from llm import LLMClient


class _LLMEmbeddingFunction(embedding_functions.EmbeddingFunction):
    def __init__(self, llm: LLMClient):
        self.llm = llm

    def __call__(self, input: List[str]) -> List[List[float]]:  # type: ignore[override]
        return self.llm.embed(input)


class ChromaVectorStore:
    def __init__(self, cfg: Settings, llm: LLMClient):
        self.client = chromadb.PersistentClient(path=cfg.chroma_persist_dir)
        self.collection = self.client.get_or_create_collection(
            name="confluence",
            embedding_function=_LLMEmbeddingFunction(llm),
            metadata={"hnsw:space": "cosine"},
        )

    def upsert(self, ids: List[str], texts: List[str], metadatas: List[Dict[str, Any]]):
        if not ids:
            return
        # Determine which ids already exist
        existing = set()
        # Chroma get allows up to N ids; for simplicity, do one call
        got = self.collection.get(ids=ids)
        for eid in got.get("ids", []) or []:
            existing.add(eid)

        # Split into adds and updates
        to_add = [i for i, _id in enumerate(ids) if _id not in existing]
        to_update = [i for i, _id in enumerate(ids) if _id in existing]

        if to_add:
            self.collection.add(
                ids=[ids[i] for i in to_add],
                documents=[texts[i] for i in to_add],
                metadatas=[metadatas[i] for i in to_add],
            )
        if to_update:
            self.collection.update(
                ids=[ids[i] for i in to_update],
                documents=[texts[i] for i in to_update],
                metadatas=[metadatas[i] for i in to_update],
            )

    def query(self, query_text: str, k: int = 5) -> List[Dict[str, Any]]:
        res = self.collection.query(query_texts=[query_text], n_results=k, include=["documents", "metadatas", "distances", "embeddings"])
        results: List[Dict[str, Any]] = []
        for i, _id in enumerate(res.get("ids", [[]])[0]):
            results.append(
                {
                    "id": _id,
                    "text": res["documents"][0][i],
                    "metadata": res["metadatas"][0][i],
                    "distance": res["distances"][0][i] if res.get("distances") else None,
                }
            )
        return results

