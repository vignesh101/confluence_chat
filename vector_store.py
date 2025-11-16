from __future__ import annotations

import hashlib
import os
import pickle
from typing import Any, Dict, List

import faiss  # type: ignore
import numpy as np

from config import Settings
from llm import LLMClient


def _l2_normalize(v: np.ndarray) -> np.ndarray:
    if v.size == 0:
        return v
    norms = np.linalg.norm(v, axis=1, keepdims=True) + 1e-12
    return v / norms


def _hash_id_to_int64(s: str) -> int:
    # Stable 64-bit ID from string
    h = hashlib.sha1(s.encode("utf-8")).digest()  # 20 bytes
    return int.from_bytes(h[:8], byteorder="big", signed=False)


class FaissVectorStore:
    def __init__(self, cfg: Settings, llm: LLMClient):
        self.cfg = cfg
        self.llm = llm
        # Use FAISS dir if provided, otherwise reuse CHROMA_DIR or default
        self.dir = getattr(cfg, "faiss_dir", None) or getattr(cfg, "chroma_persist_dir", ".faiss")
        self.dir = self.dir or ".faiss"
        os.makedirs(self.dir, exist_ok=True)
        self.index_path = os.path.join(self.dir, "index.faiss")
        self.meta_path = os.path.join(self.dir, "store.pkl")

        self.dim: int | None = None
        self.index: faiss.IndexIDMap | None = None
        self.id_to_text: Dict[int, str] = {}
        self.id_to_meta: Dict[int, Dict[str, Any]] = {}
        self.id_to_str: Dict[int, str] = {}

        self._load()

    # Persistence helpers
    def _save(self):
        if self.index is not None:
            faiss.write_index(self.index, self.index_path)
        with open(self.meta_path, "wb") as f:
            pickle.dump(
                {
                    "id_to_text": self.id_to_text,
                    "id_to_meta": self.id_to_meta,
                    "id_to_str": self.id_to_str,
                    "dim": self.dim,
                },
                f,
            )

    def _load(self):
        try:
            if os.path.exists(self.index_path):
                self.index = faiss.read_index(self.index_path)  # persisted as IDMap
            if os.path.exists(self.meta_path):
                with open(self.meta_path, "rb") as f:
                    data = pickle.load(f)
                    self.id_to_text = data.get("id_to_text", {})
                    self.id_to_meta = data.get("id_to_meta", {})
                    self.id_to_str = data.get("id_to_str", {})
                    self.dim = data.get("dim")
            # If index is still None, leave it to be recreated on first upsert
        except Exception:
            # Corruption fallback: start clean
            self.index = None
            self.id_to_text = {}
            self.id_to_meta = {}
            self.id_to_str = {}
            self.dim = None

    def _ensure_index(self, dim: int):
        if self.index is not None and self.dim == dim:
            return
        self.dim = dim
        base = faiss.IndexFlatIP(dim)
        self.index = faiss.IndexIDMap(base)

    def upsert(self, ids: List[str], texts: List[str], metadatas: List[Dict[str, Any]]):
        if not ids:
            return
        # Embed and normalize
        embs = self.llm.embed(texts)
        if not embs:
            return
        arr = np.array(embs, dtype=np.float32)
        self._ensure_index(arr.shape[1])
        arr = _l2_normalize(arr)

        # Convert IDs and prepare remove/add lists
        int_ids = [_hash_id_to_int64(s) for s in ids]

        # Remove existing ids (IndexIDMap supports remove)
        if self.index is not None and len(int_ids):
            to_remove = [iid for iid in int_ids if iid in self.id_to_text]
            if to_remove:
                rem = np.array(to_remove, dtype=np.int64)
                try:
                    self.index.remove_ids(rem)
                except Exception:
                    # Some index types may not support remove; recreate from metadata (costly)
                    base = faiss.IndexFlatIP(self.dim or arr.shape[1])
                    new_index = faiss.IndexIDMap(base)
                    # Re-add all existing (excluding removed)
                    keep_ids = [k for k in self.id_to_text.keys() if k not in set(to_remove)]
                    if keep_ids:
                        vecs = []
                        ids_np = []
                        for iid in keep_ids:
                            vecs.append(self.llm.embed([self.id_to_text[iid]])[0])
                            ids_np.append(iid)
                        X = _l2_normalize(np.array(vecs, dtype=np.float32))
                        new_index.add_with_ids(X, np.array(ids_np, dtype=np.int64))
                    self.index = new_index

        # Add current batch
        if self.index is None:
            self._ensure_index(arr.shape[1])
        self.index.add_with_ids(arr, np.array(int_ids, dtype=np.int64))

        # Update maps
        for iid, sid, text, meta in zip(int_ids, ids, texts, metadatas):
            self.id_to_text[iid] = text
            self.id_to_meta[iid] = meta
            self.id_to_str[iid] = sid

        self._save()

    def query(self, query_text: str, k: int = 5) -> List[Dict[str, Any]]:
        if self.index is None or (self.dim or 0) == 0:
            return []
        q = self.llm.embed([query_text])
        if not q:
            return []
        Xq = _l2_normalize(np.array(q, dtype=np.float32))
        D, I = self.index.search(Xq, k)
        results: List[Dict[str, Any]] = []
        for dist, iid in zip(D[0], I[0]):
            if iid == -1:
                continue
            text = self.id_to_text.get(int(iid))
            meta = self.id_to_meta.get(int(iid))
            sid = self.id_to_str.get(int(iid), str(iid))
            if text is None or meta is None:
                continue
            results.append(
                {
                    "id": sid,
                    "text": text,
                    "metadata": meta,
                    # Cosine similarity since vectors are normalized; convert to distance-like if needed
                    "distance": float(1 - dist),
                }
            )
        return results
