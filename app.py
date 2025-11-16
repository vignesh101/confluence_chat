from __future__ import annotations

import chainlit as cl

from config import load_settings
from rag import RAGPipeline, RetrievedChunk


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
            cl.Action(name="new_chat", value="new", label="Start New Chat", description="Clear history and start fresh"),
        ],
    ).send()


@cl.action_callback("new_chat")
async def restart_chat(action: cl.Action):
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

    # Stream a placeholder while we compute
    msg = cl.Message(content="Thinking...")
    await msg.send()

    try:
        answer, contexts = await cl.make_async(rag.answer)(message.content, history)
        sources_block = _format_sources(contexts)
        final = answer + (f"\n\n{sources_block}" if sources_block else "")
        msg.content = final
        await msg.update()
        # Append assistant response for continuity
        history.append({"role": "assistant", "content": answer})
        cl.user_session.set("history", history)
    except Exception as e:
        msg.content = f"Error: {e}"
        await msg.update()

