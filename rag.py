from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Tuple
import re
from collections import defaultdict
import numpy as np

from config import Settings
from confluence_client import ConfluenceClient
from llm import LLMClient
from vector_store import FaissVectorStore


@dataclass
class RetrievedChunk:
    id: str
    text: str
    metadata: Dict[str, Any]
    distance: float | None

@dataclass
class QueryDebugInfo:
    original_query: str
    expanded_queries: List[str]
    cql: str | None
    pages_considered: int
    candidate_pool_size: int
    selected_count: int
    top_k: int
    mmr_lambda: float
    max_chunks_per_page: int
    context_chars: int
    context_budget: int
    selected_items: List[Dict[str, Any]]  # title, page_id, url, similarity
    analysis: str | None


def chunk_text(text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
    if chunk_size <= 0:
        return [text]
    chunks: List[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(n, start + chunk_size)
        chunk = text[start:end]

        # Try to break at sentence boundaries for better context
        if end < n:
            # Look for sentence endings near the end
            last_period = chunk.rfind(". ")
            last_newline = chunk.rfind("\n")
            last_question = chunk.rfind("? ")
            last_exclaim = chunk.rfind("! ")

            # Find the best break point (closest to end but still a sentence boundary)
            break_points = [p for p in [last_period, last_newline, last_question, last_exclaim] if p > chunk_size * 0.6]
            if break_points:
                best_break = max(break_points)
                chunk = text[start:start + best_break + 1].strip()
                end = start + best_break + 1

        chunks.append(chunk.strip())
        if end >= n:
            break
        start = max(end - chunk_overlap, start + 1)
    return [c for c in chunks if c]  # Remove empty chunks


class RAGPipeline:
    def __init__(self, cfg: Settings):
        self.cfg = cfg
        self.llm = LLMClient(cfg)
        self.store = FaissVectorStore(cfg, self.llm)
        self.confluence = ConfluenceClient(cfg)

    def _expand_queries(self, query: str) -> List[str]:
        if not self.cfg.use_multi_query or self.cfg.num_query_variants <= 0:
            return [query]
        prompt = (
            "You rewrite search queries for retrieval. Given the user's question, "
            f"produce {self.cfg.num_query_variants} distinct alternative phrasings that preserve intent. "
            "Only output the alternatives, one per line, no numbering or extra text."
        )
        msgs = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": query},
        ]
        try:
            raw = self.llm.chat(msgs, temperature=0.2)
            lines = [re.sub(r"^[\-\d\.)\s]+", "", ln).strip() for ln in raw.splitlines()]
            alts = [ln for ln in lines if ln]
        except Exception:
            alts = []
        uniq: List[str] = []
        seen = set()
        for q in [query] + alts:
            k = q.lower()
            if k not in seen:
                uniq.append(q)
                seen.add(k)
        return uniq

    def _mmr_select(
        self,
        query_vec: np.ndarray,
        candidates: List[RetrievedChunk],
        k: int,
        lambda_mult: float,
        max_per_page: int,
    ) -> List[RetrievedChunk]:
        if not candidates:
            return []
        # Embed all candidate texts (batch)
        texts = [c.text for c in candidates]
        doc_vecs = np.array(self.llm.embed(texts), dtype=np.float32)
        # Normalize
        if doc_vecs.size == 0:
            return []
        doc_vecs = doc_vecs / (np.linalg.norm(doc_vecs, axis=1, keepdims=True) + 1e-12)
        qv = query_vec / (np.linalg.norm(query_vec, keepdims=True) + 1e-12)
        sims = (doc_vecs @ qv.reshape(-1, 1)).flatten()

        selected: List[int] = []
        remaining = list(range(len(candidates)))
        per_page_counts: Dict[str, int] = defaultdict(int)

        # Pick the first by highest sim
        while remaining and len(selected) < k:
            if not selected:
                # Try the best that doesn't exceed per-page limit
                ranked = sorted(remaining, key=lambda i: sims[i], reverse=True)
                picked = None
                for i in ranked:
                    page = candidates[i].metadata.get("page_id") or ""
                    if per_page_counts[page] < max_per_page:
                        picked = i
                        break
                if picked is None:
                    break
                selected.append(picked)
                remaining.remove(picked)
                per_page_counts[candidates[picked].metadata.get("page_id") or ""] += 1
                continue

            # For MMR, compute diversity term against selected
            sel_vecs = doc_vecs[selected, :]
            # max similarity to any selected
            if sel_vecs.size:
                max_sim_to_selected = np.max(doc_vecs[remaining, :] @ sel_vecs.T, axis=1)
            else:
                max_sim_to_selected = np.zeros(len(remaining), dtype=np.float32)

            mmr_scores = lambda_mult * sims[remaining] - (1.0 - lambda_mult) * max_sim_to_selected
            ranked = [remaining[i] for i in np.argsort(-mmr_scores)]
            picked = None
            for idx in ranked:
                page = candidates[idx].metadata.get("page_id") or ""
                if per_page_counts[page] < max_per_page:
                    picked = idx
                    break
            if picked is None:
                break
            selected.append(picked)
            remaining.remove(picked)
            per_page_counts[candidates[picked].metadata.get("page_id") or ""] += 1

        return [candidates[i] for i in selected]

    def _analyze_query(self, query: str) -> str | None:
        prompt = (
            "Analyze the user's query to aid retrieval. "
            "Summarize in bullets: intent, key entities/terms, timeframe, constraints (spaces/labels), and ambiguities. "
            "Keep it concise and factual."
        )
        msgs = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": query},
        ]
        try:
            return self.llm.chat(msgs, temperature=0.0)
        except Exception:
            return None

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

    def retrieve(self, query: str) -> Tuple[List[RetrievedChunk], QueryDebugInfo]:
        # Search Confluence first to discover candidate pages across all spaces
        pages = self.confluence.search_pages(query, limit=self.cfg.max_confluence_search_results)
        # Ensure their content is indexed in the vector store
        if pages:
            self._ensure_pages_indexed(pages)

        # Build a pool via multi-query retrieval
        queries = self._expand_queries(query)
        pool_k = max(self.cfg.top_k * max(1, self.cfg.retrieval_pool_factor), self.cfg.top_k)
        pool: Dict[str, RetrievedChunk] = {}
        for q in queries:
            hits = self.store.query(q, k=pool_k)
            for h in hits:
                rid = h["id"]
                if rid not in pool:
                    pool[rid] = RetrievedChunk(id=h["id"], text=h["text"], metadata=h["metadata"], distance=h.get("distance"))

        cands = list(pool.values())
        if not cands:
            dbg = QueryDebugInfo(
                original_query=query,
                expanded_queries=queries,
                cql=getattr(self.confluence, "last_cql", None),
                pages_considered=len(pages or []),
                candidate_pool_size=0,
                selected_count=0,
                top_k=self.cfg.top_k,
                mmr_lambda=self.cfg.mmr_lambda,
                max_chunks_per_page=max(1, self.cfg.max_chunks_per_page),
                context_chars=0,
                context_budget=max(1000, self.cfg.max_context_chars),
                selected_items=[],
                analysis=self._analyze_query(query) if getattr(self.cfg, "show_query_details", False) else None,
            )
            return [], dbg

        # MMR selection with per-page caps
        qv = np.array(self.llm.embed([query])[0], dtype=np.float32)
        selected = self._mmr_select(
            query_vec=qv,
            candidates=cands,
            k=self.cfg.top_k,
            lambda_mult=self.cfg.mmr_lambda,
            max_per_page=max(1, self.cfg.max_chunks_per_page),
        )

        # Enforce context char budget
        total = 0
        final: List[RetrievedChunk] = []
        budget = max(1000, self.cfg.max_context_chars)
        for c in selected:
            t = c.text
            if total + len(t) <= budget:
                final.append(c)
                total += len(t)
            else:
                if total < budget:
                    remain = budget - total
                    if remain > 50:
                        final.append(
                            RetrievedChunk(
                                id=c.id,
                                text=t[:remain],
                                metadata=c.metadata,
                                distance=c.distance,
                            )
                        )
                break
        # Compute similarity of selected to original query for debugging
        sel_texts = [c.text for c in final]
        sel_sims: List[float] = []
        if sel_texts:
            vecs = np.array(self.llm.embed(sel_texts), dtype=np.float32)
            vecs = vecs / (np.linalg.norm(vecs, axis=1, keepdims=True) + 1e-12)
            qvn = qv / (np.linalg.norm(qv, keepdims=True) + 1e-12)
            sel_sims = (vecs @ qvn.reshape(-1, 1)).flatten().tolist()

        items: List[Dict[str, Any]] = []
        for i, c in enumerate(final):
            items.append(
                {
                    "title": c.metadata.get("title") or "Untitled",
                    "page_id": c.metadata.get("page_id") or c.metadata.get("id"),
                    "url": c.metadata.get("url"),
                    "similarity": float(sel_sims[i]) if i < len(sel_sims) else None,
                }
            )

        dbg = QueryDebugInfo(
            original_query=query,
            expanded_queries=queries,
            cql=getattr(self.confluence, "last_cql", None),
            pages_considered=len(pages or []),
            candidate_pool_size=len(cands),
            selected_count=len(final),
            top_k=self.cfg.top_k,
            mmr_lambda=self.cfg.mmr_lambda,
            max_chunks_per_page=max(1, self.cfg.max_chunks_per_page),
            context_chars=total,
            context_budget=budget,
            selected_items=items,
            analysis=self._analyze_query(query) if getattr(self.cfg, "show_query_details", False) else None,
        )
        return final, dbg

    def build_prompt(self, query: str, history: List[Dict[str, str]], contexts: List[RetrievedChunk]) -> List[Dict[str, str]]:
        system = (
            "You are a knowledgeable assistant that provides comprehensive and detailed answers based on Confluence documentation. "
            "Your goal is to give users exact, actionable information from the source material.\n\n"
            "Guidelines:\n"
            "- Provide DETAILED and COMPLETE answers with specific information from the context\n"
            "- Include exact steps, configurations, code examples, or procedures when available\n"
            "- Use inline citations like [1], [2] that match the context list\n"
            "- Cite immediately after each piece of information you reference\n"
            "- Structure your response clearly with sections, bullet points, or numbered steps when appropriate\n"
            "- If the context contains relevant details like version numbers, file paths, command examples, or configuration settings, include them\n"
            "- If context is insufficient for a complete answer, clearly state what information is missing and suggest how to find it\n"
            "- Do NOT summarize or oversimplify - provide the full details available in the context\n"
            "- If multiple sources discuss the same topic, synthesize the information and cite all relevant sources"
        )
        ctx_block_lines: List[str] = []
        for i, c in enumerate(contexts, start=1):
            title = c.metadata.get("title") or "Untitled"
            url = c.metadata.get("url") or ""
            space = c.metadata.get("space") or ""
            header = f"[{i}] {title}"
            if space:
                header += f" (Space: {space})"
            if url:
                header += f"\nURL: {url}"
            ctx_block_lines.append(f"{header}\n---\n{c.text}")
        ctx_block = "\n\n".join(ctx_block_lines) if ctx_block_lines else "(no context found)"

        user_prompt = (
            "Based on the Confluence documentation context below, provide a detailed and comprehensive answer to the user's question. "
            "Include all relevant specifics, examples, and actionable information.\n\n"
            f"=== CONTEXT FROM CONFLUENCE ===\n{ctx_block}\n\n"
            f"=== USER QUESTION ===\n{query}\n\n"
            "Provide a detailed answer with citations:"
        )
        messages: List[Dict[str, str]] = [{"role": "system", "content": system}]
        # Add brief summarized chat history for continuity
        for msg in history[-self.cfg.max_history_turns:]:  # keep last N items
            role = msg.get("role") or ("user" if msg.get("is_user") else "assistant")
            messages.append({"role": role, "content": msg.get("content", "")})
        messages.append({"role": "user", "content": user_prompt})
        return messages

    def answer(self, query: str, history: List[Dict[str, str]]) -> Tuple[str, List[RetrievedChunk], QueryDebugInfo]:
        contexts, dbg = self.retrieve(query)
        msgs = self.build_prompt(query, history, contexts)
        answer = self.llm.chat(msgs, temperature=self.cfg.temperature)
        return answer, contexts, dbg
