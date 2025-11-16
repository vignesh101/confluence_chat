from __future__ import annotations

import chainlit as cl

from config import load_settings
from rag import RAGPipeline, RetrievedChunk, QueryDebugInfo


@cl.on_chat_start
async def on_chat_start():
    cfg = load_settings()

    # Persist session state
    cl.user_session.set("history", [])

    # Instantiate RAG pipeline (LLM, Confluence client, vector store)
    try:
        rag = RAGPipeline(cfg)
    except Exception as e:
        await cl.Message(content=f"Configuration error: {e}").send()
        return
    cl.user_session.set("rag", rag)

    # Show a helper action to reset
    await cl.Message(
        content=(
            "Hi! Ask me anything about your Confluence.\n\n"
            "Use the 'Start New Chat' action below to clear this conversation."
        ),
        actions=[
            # Include an explicit payload to satisfy Chainlit's Action schema in some versions
            cl.Action(
                name="new_chat",
                value="new",
                label="Start New Chat",
                description="Clear history and start fresh",
                payload={},
            ),
        ],
    ).send()


@cl.action_callback("new_chat")
async def restart_chat(action=None):
    # Clear session history
    cl.user_session.set("history", [])
    await cl.Message(content="History cleared. You can start a new chat now.").send()


def _format_sources(chunks: list[RetrievedChunk]) -> str:
    if not chunks:
        return ""
    lines = ["\nSources:"]
    seen = set()
    for c in chunks:
        url = c.metadata.get("url")
        title = c.metadata.get("title") or c.metadata.get("page_id")
        key = (title, url)
        if key in seen:
            continue
        seen.add(key)
        if url:
            lines.append(f"- {title}: {url}")
        else:
            lines.append(f"- {title}")
    return "\n".join(lines)


def _format_query_details(dbg: QueryDebugInfo) -> str:
    # Collapsible markdown details block
    lines: list[str] = []
    lines.append("\n<details>\n<summary><strong>Query details</strong></summary>\n")
    lines.append("")
    lines.append(f"- Original query: `{dbg.original_query}`")
    if dbg.expanded_queries and (len(dbg.expanded_queries) > 1 or dbg.expanded_queries[0] != dbg.original_query):
        lines.append("- Expanded queries:")
        for q in dbg.expanded_queries:
            lines.append(f"  - {q}")
    if dbg.cql:
        lines.append(f"- Confluence CQL: `{dbg.cql}`")
    lines.append(f"- Pages considered: {dbg.pages_considered}")
    lines.append(f"- Candidate pool size: {dbg.candidate_pool_size}")
    lines.append(f"- Selected: {dbg.selected_count} / top_k={dbg.top_k}; MMR={dbg.mmr_lambda}; max_chunks_per_page={dbg.max_chunks_per_page}")
    lines.append(f"- Context size: {dbg.context_chars} chars (budget {dbg.context_budget})")
    if dbg.selected_items:
        lines.append("- Selected items:")
        for i, it in enumerate(dbg.selected_items, start=1):
            title = it.get("title") or "Untitled"
            url = it.get("url")
            sim = it.get("similarity")
            sim_txt = f" sim={sim:.3f}" if isinstance(sim, float) else ""
            if url:
                lines.append(f"  - [{i}] {title} ({url}){sim_txt}")
            else:
                lines.append(f"  - [{i}] {title}{sim_txt}")
    if dbg.analysis:
        lines.append("\n- Query analysis:")
        # Indent analysis block
        for ln in dbg.analysis.splitlines():
            lines.append(f"  {ln}")
    lines.append("\n</details>")
    return "\n".join(lines)


@cl.on_message
async def on_message(message: cl.Message):
    rag: RAGPipeline | None = cl.user_session.get("rag")  # type: ignore
    history: list[dict] = cl.user_session.get("history") or []  # type: ignore
    if not rag:
        await cl.Message(content="RAG pipeline not ready. Check configuration.").send()
        return

    # Append user message to history
    history.append({"role": "user", "content": message.content, "is_user": True})
    cl.user_session.set("history", history)

    try:
        # Live status message for real-time progress
        status = cl.Message(content="🔎 Searching Confluence…")
        await status.send()

        # 1) Search pages
        pages = await cl.make_async(rag.confluence.search_pages)(
            message.content, limit=rag.cfg.max_confluence_search_results
        )
        await status.update(content=f"🔎 Found {len(pages)} pages. Indexing content…")

        # 2) Ensure pages are indexed into vector store
        if pages:
            await cl.make_async(rag._ensure_pages_indexed)(pages)  # type: ignore[attr-defined]

        # 3) Expand queries (optional)
        queries = await cl.make_async(rag._expand_queries)(message.content)  # type: ignore[attr-defined]
        if len(queries) > 1:
            await status.update(content=f"🧭 Expanded to {len(queries)} queries. Retrieving candidates…")
        else:
            await status.update(content="🧭 Using original query. Retrieving candidates…")

        # 4) Retrieve and select context (includes MMR & budget)
        contexts, dbg = await cl.make_async(rag.retrieve)(message.content)
        await status.update(content=f"📚 Selected {len(contexts)} context chunks. Building prompt…")

        # 5) Build prompt
        msgs = rag.build_prompt(message.content, history, contexts)
        await status.update(content="✍️ Generating answer…")

        # 6) Stream the final answer tokens
        answer_msg = cl.Message(content="")
        await answer_msg.send()
        answer_text = ""
        for token in rag.llm.chat_stream(msgs, temperature=rag.cfg.temperature):
            answer_text += token
            await answer_msg.stream_token(token)

        # 7) Append sources and optional details
        sources_block = _format_sources(contexts)
        details_block = _format_query_details(dbg) if getattr(rag.cfg, "show_query_details", False) else ""
        final = answer_text
        if sources_block:
            final += f"\n\n{sources_block}"
        if details_block:
            final += f"\n\n{details_block}"
        await answer_msg.update(content=final)

        # Done
        await status.update(content="✅ Done")

        # Append assistant response for continuity
        history.append({"role": "assistant", "content": answer_text})
        cl.user_session.set("history", history)
    except Exception as e:
        try:
            await status.update(content=f"❌ Error: {e}")  # type: ignore[has-type]
        except Exception:
            pass
        await cl.Message(content=f"Error: {e}").send()
