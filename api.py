"""
FastAPI backend for Confluence Chat with WebSocket support for streaming responses.
"""
import asyncio
import json
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from config import settings
from rag import RAGPipeline, QueryDebugInfo
from conversation_db import (
    create_conversation,
    save_message,
    get_conversation_messages,
    list_conversations,
    delete_conversation,
    update_conversation_title,
    toggle_pin_conversation,
    archive_conversation,
    unarchive_conversation,
    clear_all_conversations,
    get_conversation_stats,
    export_conversation,
    import_conversation,
    search_conversations,
    edit_message,
    delete_message,
    toggle_bookmark_message,
    set_message_feedback,
    get_bookmarked_messages,
    search_messages_in_conversation,
    update_conversation_system_prompt,
    get_conversation_system_prompt,
    update_conversation_tags,
    create_template,
    list_templates,
    get_template,
    update_template,
    delete_template,
    increment_template_usage,
    get_setting,
    set_setting,
    get_all_settings,
    delete_messages_after,
)


# Global RAG pipeline instance
rag_pipeline: Optional[RAGPipeline] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize RAG pipeline on startup."""
    global rag_pipeline
    print("Initializing RAG pipeline...")
    rag_pipeline = RAGPipeline(settings)
    print("RAG pipeline initialized successfully")
    yield
    print("Shutting down...")


app = FastAPI(
    title="Confluence Chat API",
    description="RAG-based chat interface for Confluence",
    version="2.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models
class ConversationCreate(BaseModel):
    title: Optional[str] = None


class ConversationUpdate(BaseModel):
    title: str


class MessageRequest(BaseModel):
    conversation_id: str
    content: str
    history: list[dict] = []


class ConversationResponse(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    preview: Optional[str]
    is_pinned: bool
    is_archived: bool
    message_count: int


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    timestamp: str


class ClearHistoryRequest(BaseModel):
    include_pinned: bool = False


class ImportConversationRequest(BaseModel):
    data: dict


class MessageEditRequest(BaseModel):
    content: str


class MessageFeedbackRequest(BaseModel):
    feedback: int  # -1, 0, or 1


class SystemPromptRequest(BaseModel):
    system_prompt: str


class TagsRequest(BaseModel):
    tags: list[str]


class TemplateCreateRequest(BaseModel):
    name: str
    description: str = ""
    system_prompt: str = ""
    initial_message: str = ""


class TemplateUpdateRequest(BaseModel):
    name: str
    description: str
    system_prompt: str
    initial_message: str


class SettingRequest(BaseModel):
    key: str
    value: str


# Global stop flag for cancellation
stop_generation_flags: dict[str, bool] = {}


# REST API Endpoints
@app.get("/api/health")
async def health_check():
    """Check if the API is running and RAG pipeline is initialized."""
    return {
        "status": "healthy",
        "rag_initialized": rag_pipeline is not None,
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/api/conversations", response_model=dict)
async def create_new_conversation(data: ConversationCreate):
    """Create a new conversation."""
    conversation_id = create_conversation(data.title)
    return {"id": conversation_id, "title": data.title or "New Conversation"}


@app.get("/api/conversations")
async def get_conversations(include_archived: bool = False):
    """List all conversations."""
    conversations = list_conversations(include_archived=include_archived)
    return conversations


@app.get("/api/conversations/search")
async def search_convs(q: str):
    """Search conversations by title or content."""
    if not q or len(q) < 2:
        return []
    return search_conversations(q)


@app.get("/api/conversations/stats")
async def get_stats():
    """Get conversation statistics."""
    return get_conversation_stats()


@app.get("/api/conversations/{conversation_id}/messages")
async def get_messages(conversation_id: str):
    """Get all messages for a conversation."""
    messages = get_conversation_messages(conversation_id)
    if not messages:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return [
        {
            "id": msg.get("id", ""),
            "role": msg["role"],
            "content": msg["content"],
            "timestamp": msg["timestamp"],
        }
        for msg in messages
    ]


@app.get("/api/conversations/{conversation_id}/export")
async def export_conv(conversation_id: str):
    """Export a conversation with all messages."""
    data = export_conversation(conversation_id)
    if not data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return data


@app.put("/api/conversations/{conversation_id}")
async def update_conversation(conversation_id: str, data: ConversationUpdate):
    """Update conversation title."""
    update_conversation_title(conversation_id, data.title)
    return {"status": "success", "id": conversation_id, "title": data.title}


@app.post("/api/conversations/{conversation_id}/pin")
async def toggle_pin(conversation_id: str):
    """Toggle pin status of a conversation."""
    toggle_pin_conversation(conversation_id)
    return {"status": "success", "id": conversation_id}


@app.post("/api/conversations/{conversation_id}/archive")
async def archive_conv(conversation_id: str):
    """Archive a conversation."""
    archive_conversation(conversation_id)
    return {"status": "success", "id": conversation_id}


@app.post("/api/conversations/{conversation_id}/unarchive")
async def unarchive_conv(conversation_id: str):
    """Unarchive a conversation."""
    unarchive_conversation(conversation_id)
    return {"status": "success", "id": conversation_id}


@app.delete("/api/conversations/{conversation_id}")
async def remove_conversation(conversation_id: str):
    """Delete a conversation."""
    delete_conversation(conversation_id)
    return {"status": "success", "id": conversation_id}


@app.post("/api/conversations/clear")
async def clear_history(data: ClearHistoryRequest):
    """Clear all conversations (optionally including pinned)."""
    count = clear_all_conversations(include_pinned=data.include_pinned)
    return {"status": "success", "deleted_count": count}


@app.post("/api/conversations/import")
async def import_conv(data: ImportConversationRequest):
    """Import a conversation from exported data."""
    conv_id = import_conversation(data.data)
    return {"status": "success", "id": conv_id}


# Message operations
@app.put("/api/messages/{message_id}")
async def edit_msg(message_id: str, data: MessageEditRequest):
    """Edit a message."""
    success = edit_message(message_id, data.content)
    if not success:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"status": "success", "id": message_id}


@app.delete("/api/messages/{message_id}")
async def delete_msg(message_id: str):
    """Delete a message."""
    success = delete_message(message_id)
    if not success:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"status": "success", "id": message_id}


@app.post("/api/messages/{message_id}/bookmark")
async def toggle_bookmark(message_id: str):
    """Toggle bookmark status of a message."""
    success = toggle_bookmark_message(message_id)
    if not success:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"status": "success", "id": message_id}


@app.post("/api/messages/{message_id}/feedback")
async def set_feedback(message_id: str, data: MessageFeedbackRequest):
    """Set feedback for a message."""
    success = set_message_feedback(message_id, data.feedback)
    if not success:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"status": "success", "id": message_id, "feedback": data.feedback}


@app.get("/api/bookmarks")
async def get_bookmarks(conversation_id: Optional[str] = None):
    """Get all bookmarked messages."""
    return get_bookmarked_messages(conversation_id)


@app.get("/api/conversations/{conversation_id}/search")
async def search_in_conversation(conversation_id: str, q: str):
    """Search messages within a conversation."""
    if not q or len(q) < 2:
        return []
    return search_messages_in_conversation(conversation_id, q)


# System prompt
@app.get("/api/conversations/{conversation_id}/system-prompt")
async def get_system_prompt(conversation_id: str):
    """Get conversation's system prompt."""
    prompt = get_conversation_system_prompt(conversation_id)
    return {"system_prompt": prompt}


@app.put("/api/conversations/{conversation_id}/system-prompt")
async def set_system_prompt(conversation_id: str, data: SystemPromptRequest):
    """Set conversation's system prompt."""
    success = update_conversation_system_prompt(conversation_id, data.system_prompt)
    return {"status": "success", "id": conversation_id}


@app.put("/api/conversations/{conversation_id}/tags")
async def set_tags(conversation_id: str, data: TagsRequest):
    """Set conversation's tags."""
    success = update_conversation_tags(conversation_id, data.tags)
    return {"status": "success", "id": conversation_id, "tags": data.tags}


# Templates
@app.get("/api/templates")
async def get_templates():
    """List all templates."""
    return list_templates()


@app.post("/api/templates")
async def create_new_template(data: TemplateCreateRequest):
    """Create a new template."""
    template_id = create_template(data.name, data.description, data.system_prompt, data.initial_message)
    return {"status": "success", "id": template_id}


@app.get("/api/templates/{template_id}")
async def get_single_template(template_id: str):
    """Get a specific template."""
    template = get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@app.put("/api/templates/{template_id}")
async def update_single_template(template_id: str, data: TemplateUpdateRequest):
    """Update a template."""
    success = update_template(template_id, data.name, data.description, data.system_prompt, data.initial_message)
    if not success:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"status": "success", "id": template_id}


@app.delete("/api/templates/{template_id}")
async def delete_single_template(template_id: str):
    """Delete a template."""
    success = delete_template(template_id)
    if not success:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"status": "success", "id": template_id}


@app.post("/api/templates/{template_id}/use")
async def use_template(template_id: str):
    """Mark a template as used (increment counter)."""
    success = increment_template_usage(template_id)
    return {"status": "success", "id": template_id}


# Settings
@app.get("/api/settings")
async def get_settings():
    """Get all settings."""
    return get_all_settings()


@app.get("/api/settings/{key}")
async def get_single_setting(key: str):
    """Get a single setting."""
    value = get_setting(key)
    return {"key": key, "value": value}


@app.put("/api/settings/{key}")
async def set_single_setting(key: str, data: SettingRequest):
    """Set a single setting."""
    set_setting(key, data.value)
    return {"status": "success", "key": key, "value": data.value}


# Stop generation
@app.post("/api/conversations/{conversation_id}/stop")
async def stop_generation(conversation_id: str):
    """Signal to stop generation for a conversation."""
    stop_generation_flags[conversation_id] = True
    return {"status": "success", "message": "Stop signal sent"}


# Regenerate (delete messages after and prepare for new generation)
@app.post("/api/messages/{message_id}/regenerate")
async def prepare_regenerate(message_id: str, conversation_id: str):
    """Delete messages after this one to prepare for regeneration."""
    count = delete_messages_after(conversation_id, message_id)
    return {"status": "success", "deleted_count": count}


def format_sources(chunks: list) -> str:
    """Format retrieved chunks as source citations."""
    if not chunks:
        return ""

    sources = []
    seen_pages = set()

    for i, chunk in enumerate(chunks, 1):
        page_id = chunk.metadata.get("page_id")
        if page_id and page_id not in seen_pages:
            seen_pages.add(page_id)
            title = chunk.metadata.get("title", "Unknown")
            url = chunk.metadata.get("url", "#")
            sources.append(f"[{i}] [{title}]({url})")

    if sources:
        return "\n\n---\n**Sources:**\n" + "\n".join(sources)
    return ""


def format_debug_info(debug_info: QueryDebugInfo) -> dict:
    """Format query debug information for the frontend."""
    return {
        "original_query": debug_info.original_query,
        "expanded_queries": debug_info.expanded_queries,
        "cql_query": debug_info.cql,
        "pages_searched": debug_info.pages_considered,
        "total_chunks_considered": debug_info.candidate_pool_size,
        "chunks_selected": debug_info.selected_count,
        "context_chars_used": debug_info.context_chars,
        "context_budget": debug_info.context_budget,
        "top_k": debug_info.top_k,
        "mmr_lambda": debug_info.mmr_lambda,
        "max_chunks_per_page": debug_info.max_chunks_per_page,
        "selected_chunks_info": [
            {
                "page_title": item.get("title", "Unknown"),
                "page_url": item.get("url", "#"),
                "similarity": round(item.get("similarity", 0), 4),
            }
            for item in debug_info.selected_items[:5]  # Show top 5
        ],
    }


# WebSocket for streaming chat
@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """WebSocket endpoint for streaming chat responses."""
    await websocket.accept()

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            request = json.loads(data)

            conversation_id = request.get("conversation_id")
            user_message = request.get("content", "").strip()
            history = request.get("history", [])

            if not user_message:
                await websocket.send_json({"type": "error", "content": "Empty message"})
                continue

            if not conversation_id:
                await websocket.send_json({"type": "error", "content": "No conversation ID"})
                continue

            # Save user message
            save_message(conversation_id, "user", user_message)

            # Send progress updates
            await websocket.send_json({"type": "status", "content": "Searching Confluence..."})

            try:
                # Build conversation history for context
                conv_history = []
                for msg in history[-settings.max_history_turns * 2:]:
                    conv_history.append({
                        "role": msg.get("role", "user"),
                        "content": msg.get("content", ""),
                    })

                # Retrieve relevant context
                await websocket.send_json({"type": "status", "content": "Retrieving relevant information..."})

                # Run retrieval in thread pool to avoid blocking
                loop = asyncio.get_event_loop()
                chunks, debug_info = await loop.run_in_executor(
                    None, rag_pipeline.retrieve, user_message
                )

                await websocket.send_json({"type": "status", "content": "Generating response..."})

                # Build prompt
                system_prompt, user_prompt = rag_pipeline.build_prompt(
                    user_message, chunks, conv_history
                )

                messages = [{"role": "system", "content": system_prompt}]

                # Add conversation history
                for msg in conv_history:
                    messages.append(msg)

                messages.append({"role": "user", "content": user_prompt})

                # Stream the response
                full_response = ""

                for token in rag_pipeline.llm.chat_stream(messages):
                    full_response += token
                    await websocket.send_json({
                        "type": "token",
                        "content": token,
                    })
                    await asyncio.sleep(0.01)  # Small delay for smooth streaming

                # Add sources
                sources = format_sources(chunks)
                if sources:
                    full_response += sources
                    await websocket.send_json({
                        "type": "sources",
                        "content": sources,
                    })

                # Save assistant message
                save_message(conversation_id, "assistant", full_response)

                # Send debug info if enabled
                if settings.show_query_details and debug_info:
                    await websocket.send_json({
                        "type": "debug",
                        "content": format_debug_info(debug_info),
                    })

                # Send completion signal
                await websocket.send_json({
                    "type": "complete",
                    "content": full_response,
                })

            except Exception as e:
                error_msg = f"Error processing message: {str(e)}"
                print(f"Error: {error_msg}")
                await websocket.send_json({
                    "type": "error",
                    "content": error_msg,
                })

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
        try:
            await websocket.close()
        except:
            pass


# Serve React app (production)
@app.get("/")
async def serve_react_app():
    """Serve the React app."""
    return FileResponse("frontend/dist/index.html")


# Mount static files for React app
try:
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")
except:
    pass  # Directory might not exist yet


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
