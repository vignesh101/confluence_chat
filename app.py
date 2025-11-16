from __future__ import annotations

import json
import chainlit as cl

from config import load_settings
from rag import RAGPipeline, RetrievedChunk, QueryDebugInfo
import conversation_db as cdb


@cl.on_chat_start
async def on_chat_start():
    cfg = load_settings()

    # Create a new conversation in the database
    conv_id = cdb.create_conversation()
    cl.user_session.set("conversation_id", conv_id)

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
            "Use the actions below to manage your conversation."
        ),
        actions=[
            cl.Action(
                name="show_history",
                value="history",
                label="📜 Show History",
                description="View conversation history",
                payload={},
            ),
            cl.Action(
                name="new_chat",
                value="new",
                label="🔄 Start New Chat",
                description="Clear history and start fresh",
                payload={},
            ),
        ],
    ).send()


@cl.action_callback("new_chat")
async def restart_chat(action=None):
    # Create a new conversation in the database
    conv_id = cdb.create_conversation()
    cl.user_session.set("conversation_id", conv_id)
    # Clear session history
    cl.user_session.set("history", [])
    await cl.Message(content="History cleared. You can start a new chat now.").send()


@cl.action_callback("show_history")
async def show_history(action=None):
    history: list[dict] = cl.user_session.get("history") or []
    if not history:
        await cl.Message(content="📜 **Conversation History**\n\nNo conversation history yet. Start asking questions!").send()
        return

    # Format history for display
    lines = ["📜 **Conversation History**\n"]
    for i, msg in enumerate(history, start=1):
        role = msg.get("role", "user" if msg.get("is_user") else "assistant")
        content = msg.get("content", "")
        # Truncate long messages for display
        if len(content) > 500:
            content = content[:500] + "..."

        if role == "user":
            lines.append(f"**[{i}] 👤 User:**\n{content}\n")
        else:
            lines.append(f"**[{i}] 🤖 Assistant:**\n{content}\n")

    lines.append(f"\n---\n*Total exchanges: {len(history)}*")
    await cl.Message(content="\n".join(lines)).send()


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


async def handle_drawer_command(command: str):
    """Handle special commands from the history drawer UI."""
    if command == "__CMD__LIST_CONVERSATIONS__":
        conversations = cdb.list_conversations(limit=50)
        await cl.Message(
            content=f"__CONV_LIST__{json.dumps(conversations)}__END_CONV_LIST__"
        ).send()

    elif command.startswith("__CMD__LOAD__"):
        conv_id = command.replace("__CMD__LOAD__", "")
        messages = cdb.get_conversation_messages(conv_id)
        if not messages:
            await cl.Message(content="Conversation not found or empty.").send()
            return

        # Update session with loaded conversation
        cl.user_session.set("conversation_id", conv_id)
        cl.user_session.set("history", messages)

        # Display the loaded conversation
        lines = ["**Loaded conversation:**\n"]
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if len(content) > 300:
                content = content[:300] + "..."

            if role == "user":
                lines.append(f"**You:** {content}\n")
            else:
                lines.append(f"**Assistant:** {content}\n")

        lines.append(f"\n*{len(messages)} messages loaded. Continue the conversation below.*")
        await cl.Message(content="\n".join(lines)).send()

    elif command.startswith("__CMD__DELETE__"):
        conv_id = command.replace("__CMD__DELETE__", "")
        current_conv_id = cl.user_session.get("conversation_id")
        if conv_id == current_conv_id:
            await cl.Message(content="Cannot delete the current active conversation.").send()
            return

        deleted = cdb.delete_conversation(conv_id)
        if deleted:
            await cl.Message(content="__CONV_DELETED__").send()
        else:
            await cl.Message(content="Failed to delete conversation.").send()


@cl.on_message
async def on_message(message: cl.Message):
    # Handle special commands from the drawer UI
    if message.content.startswith("__CMD__"):
        await handle_drawer_command(message.content)
        return

    rag: RAGPipeline | None = cl.user_session.get("rag")  # type: ignore
    history: list[dict] = cl.user_session.get("history") or []  # type: ignore
    conv_id: str | None = cl.user_session.get("conversation_id")  # type: ignore
    if not rag:
        await cl.Message(content="RAG pipeline not ready. Check configuration.").send()
        return

    # Append user message to history
    history.append({"role": "user", "content": message.content, "is_user": True})
    cl.user_session.set("history", history)

    # Save user message to database
    if conv_id:
        cdb.save_message(conv_id, "user", message.content)

    try:
        # Live status message for real-time progress
        status = cl.Message(content="🔎 Searching Confluence…")
        await status.send()

        # 1) Search pages
        pages = await cl.make_async(rag.confluence.search_pages)(
            message.content, limit=rag.cfg.max_confluence_search_results
        )
        status.content = f"🔎 Found {len(pages)} pages. Indexing content…"
        await status.update()

        # 2) Ensure pages are indexed into vector store
        if pages:
            await cl.make_async(rag._ensure_pages_indexed)(pages)  # type: ignore[attr-defined]

        # 3) Expand queries (optional)
        queries = await cl.make_async(rag._expand_queries)(message.content)  # type: ignore[attr-defined]
        if len(queries) > 1:
            status.content = f"🧭 Expanded to {len(queries)} queries. Retrieving candidates…"
            await status.update()
        else:
            status.content = "🧭 Using original query. Retrieving candidates…"
            await status.update()

        # 4) Retrieve and select context (includes MMR & budget)
        contexts, dbg = await cl.make_async(rag.retrieve)(message.content)
        status.content = f"📚 Selected {len(contexts)} context chunks. Building prompt…"
        await status.update()

        # 5) Build prompt
        msgs = rag.build_prompt(message.content, history, contexts)
        status.content = "✍️ Generating answer…"
        await status.update()

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
        answer_msg.content = final
        await answer_msg.update()

        # Done
        status.content = "✅ Done"
        await status.update()

        # Append assistant response for continuity
        history.append({"role": "assistant", "content": answer_text})
        cl.user_session.set("history", history)

        # Save assistant response to database
        if conv_id:
            cdb.save_message(conv_id, "assistant", answer_text)
    except Exception as e:
        try:
            status.content = f"❌ Error: {e}"
            await status.update()  # type: ignore[has-type]
        except Exception:
            pass
        await cl.Message(content=f"Error: {e}").send()


# Action callbacks for history drawer
@cl.action_callback("list_conversations")
async def list_conversations_action(action=None):
    """Return list of all conversations for the drawer."""
    conversations = cdb.list_conversations(limit=50)
    # Send as a special message that the JS can parse
    await cl.Message(
        content=f"__CONV_LIST__{json.dumps(conversations)}__END_CONV_LIST__"
    ).send()


@cl.action_callback("load_conversation")
async def load_conversation_action(action):
    """Load a specific conversation into the current session."""
    conv_id = action.payload.get("conversation_id") if action.payload else None
    if not conv_id:
        await cl.Message(content="No conversation ID provided.").send()
        return

    # Load messages from database
    messages = cdb.get_conversation_messages(conv_id)
    if not messages:
        await cl.Message(content="Conversation not found or empty.").send()
        return

    # Update session with loaded conversation
    cl.user_session.set("conversation_id", conv_id)
    cl.user_session.set("history", messages)

    # Display the loaded conversation
    lines = ["**Loaded conversation:**\n"]
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if len(content) > 300:
            content = content[:300] + "..."

        if role == "user":
            lines.append(f"**You:** {content}\n")
        else:
            lines.append(f"**Assistant:** {content}\n")

    lines.append(f"\n*{len(messages)} messages loaded. Continue the conversation below.*")
    await cl.Message(content="\n".join(lines)).send()


@cl.action_callback("delete_conversation")
async def delete_conversation_action(action):
    """Delete a conversation from history."""
    conv_id = action.payload.get("conversation_id") if action.payload else None
    if not conv_id:
        await cl.Message(content="No conversation ID provided.").send()
        return

    current_conv_id = cl.user_session.get("conversation_id")
    if conv_id == current_conv_id:
        await cl.Message(content="Cannot delete the current active conversation.").send()
        return

    deleted = cdb.delete_conversation(conv_id)
    if deleted:
        await cl.Message(content="__CONV_DELETED__").send()
    else:
        await cl.Message(content="Failed to delete conversation.").send()
