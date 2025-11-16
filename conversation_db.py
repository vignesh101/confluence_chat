"""
Persistent conversation storage using SQLite.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any
import uuid


DB_PATH = Path(__file__).parent / "conversations.db"


def _get_connection() -> sqlite3.Connection:
    """Get a database connection with row factory."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database schema."""
    conn = _get_connection()
    cursor = conn.cursor()

    # Create conversations table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            preview TEXT DEFAULT '',
            is_pinned INTEGER DEFAULT 0,
            is_archived INTEGER DEFAULT 0,
            system_prompt TEXT DEFAULT '',
            tags TEXT DEFAULT ''
        )
    """)

    # Create messages table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            is_bookmarked INTEGER DEFAULT 0,
            feedback INTEGER DEFAULT 0,
            is_edited INTEGER DEFAULT 0,
            original_content TEXT DEFAULT '',
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        )
    """)

    # Create templates table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            system_prompt TEXT DEFAULT '',
            initial_message TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            usage_count INTEGER DEFAULT 0
        )
    """)

    # Create settings table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)

    # Create index for faster queries
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_messages_conversation
        ON messages(conversation_id)
    """)

    # Add new columns if they don't exist (for migration)
    migration_columns = [
        ("conversations", "is_pinned", "INTEGER DEFAULT 0"),
        ("conversations", "is_archived", "INTEGER DEFAULT 0"),
        ("conversations", "system_prompt", "TEXT DEFAULT ''"),
        ("conversations", "tags", "TEXT DEFAULT ''"),
        ("messages", "is_bookmarked", "INTEGER DEFAULT 0"),
        ("messages", "feedback", "INTEGER DEFAULT 0"),
        ("messages", "is_edited", "INTEGER DEFAULT 0"),
        ("messages", "original_content", "TEXT DEFAULT ''"),
    ]

    for table, column, col_type in migration_columns:
        try:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
        except sqlite3.OperationalError:
            pass  # Column already exists

    conn.commit()
    conn.close()


def create_conversation(title: str | None = None) -> str:
    """Create a new conversation and return its ID."""
    conn = _get_connection()
    cursor = conn.cursor()

    conv_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    if not title:
        title = f"Chat {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"

    cursor.execute(
        "INSERT INTO conversations (id, title, created_at, updated_at, preview) VALUES (?, ?, ?, ?, ?)",
        (conv_id, title, now, now, "")
    )

    conn.commit()
    conn.close()

    return conv_id


def save_message(conversation_id: str, role: str, content: str) -> str:
    """Save a message to a conversation."""
    conn = _get_connection()
    cursor = conn.cursor()

    msg_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    cursor.execute(
        "INSERT INTO messages (id, conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)",
        (msg_id, conversation_id, role, content, now)
    )

    # Update conversation's updated_at and preview
    preview = content[:100] + "..." if len(content) > 100 else content
    cursor.execute(
        "UPDATE conversations SET updated_at = ?, preview = ? WHERE id = ?",
        (now, preview, conversation_id)
    )

    # Auto-update title from first user message if title is default
    if role == "user":
        cursor.execute("SELECT title FROM conversations WHERE id = ?", (conversation_id,))
        row = cursor.fetchone()
        if row and row["title"].startswith("Chat "):
            # Generate title from first user message
            new_title = content[:50] + "..." if len(content) > 50 else content
            new_title = new_title.replace("\n", " ").strip()
            cursor.execute(
                "UPDATE conversations SET title = ? WHERE id = ?",
                (new_title, conversation_id)
            )

    conn.commit()
    conn.close()

    return msg_id


def get_conversation_messages(conversation_id: str) -> list[dict[str, Any]]:
    """Get all messages for a conversation."""
    conn = _get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT role, content, timestamp FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC",
        (conversation_id,)
    )

    messages = []
    for row in cursor.fetchall():
        messages.append({
            "role": row["role"],
            "content": row["content"],
            "timestamp": row["timestamp"],
            "is_user": row["role"] == "user"
        })

    conn.close()
    return messages


def list_conversations(limit: int = 100, include_archived: bool = False) -> list[dict[str, Any]]:
    """List all conversations ordered by pinned first, then most recent."""
    conn = _get_connection()
    cursor = conn.cursor()

    archive_filter = "" if include_archived else "WHERE c.is_archived = 0"

    cursor.execute(
        f"""
        SELECT c.id, c.title, c.created_at, c.updated_at, c.preview,
               c.is_pinned, c.is_archived,
               (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
        FROM conversations c
        {archive_filter}
        ORDER BY c.is_pinned DESC, c.updated_at DESC
        LIMIT ?
        """,
        (limit,)
    )

    conversations = []
    for row in cursor.fetchall():
        conversations.append({
            "id": row["id"],
            "title": row["title"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "preview": row["preview"],
            "is_pinned": bool(row["is_pinned"]),
            "is_archived": bool(row["is_archived"]),
            "message_count": row["message_count"]
        })

    conn.close()
    return conversations


def delete_conversation(conversation_id: str) -> bool:
    """Delete a conversation and all its messages."""
    conn = _get_connection()
    cursor = conn.cursor()

    # Delete messages first (due to foreign key)
    cursor.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
    cursor.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))

    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()

    return deleted


def update_conversation_title(conversation_id: str, title: str) -> bool:
    """Update a conversation's title."""
    conn = _get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "UPDATE conversations SET title = ? WHERE id = ?",
        (title, conversation_id)
    )

    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()

    return updated


def toggle_pin_conversation(conversation_id: str) -> bool:
    """Toggle the pinned status of a conversation."""
    conn = _get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "UPDATE conversations SET is_pinned = NOT is_pinned WHERE id = ?",
        (conversation_id,)
    )

    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()

    return updated


def archive_conversation(conversation_id: str) -> bool:
    """Archive a conversation."""
    conn = _get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "UPDATE conversations SET is_archived = 1, is_pinned = 0 WHERE id = ?",
        (conversation_id,)
    )

    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()

    return updated


def unarchive_conversation(conversation_id: str) -> bool:
    """Unarchive a conversation."""
    conn = _get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "UPDATE conversations SET is_archived = 0 WHERE id = ?",
        (conversation_id,)
    )

    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()

    return updated


def clear_all_conversations(include_pinned: bool = False) -> int:
    """Delete all conversations. Returns count of deleted conversations."""
    conn = _get_connection()
    cursor = conn.cursor()

    if include_pinned:
        cursor.execute("SELECT id FROM conversations")
    else:
        cursor.execute("SELECT id FROM conversations WHERE is_pinned = 0")

    conv_ids = [row["id"] for row in cursor.fetchall()]

    for conv_id in conv_ids:
        cursor.execute("DELETE FROM messages WHERE conversation_id = ?", (conv_id,))
        cursor.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))

    conn.commit()
    conn.close()

    return len(conv_ids)


def get_conversation_stats() -> dict[str, Any]:
    """Get statistics about all conversations."""
    conn = _get_connection()
    cursor = conn.cursor()

    # Total conversations
    cursor.execute("SELECT COUNT(*) as total FROM conversations")
    total = cursor.fetchone()["total"]

    # Active (non-archived) conversations
    cursor.execute("SELECT COUNT(*) as active FROM conversations WHERE is_archived = 0")
    active = cursor.fetchone()["active"]

    # Archived conversations
    cursor.execute("SELECT COUNT(*) as archived FROM conversations WHERE is_archived = 1")
    archived = cursor.fetchone()["archived"]

    # Pinned conversations
    cursor.execute("SELECT COUNT(*) as pinned FROM conversations WHERE is_pinned = 1")
    pinned = cursor.fetchone()["pinned"]

    # Total messages
    cursor.execute("SELECT COUNT(*) as total_messages FROM messages")
    total_messages = cursor.fetchone()["total_messages"]

    # Average messages per conversation
    avg_messages = total_messages / total if total > 0 else 0

    # Oldest conversation
    cursor.execute("SELECT created_at FROM conversations ORDER BY created_at ASC LIMIT 1")
    oldest_row = cursor.fetchone()
    oldest = oldest_row["created_at"] if oldest_row else None

    # Most recent activity
    cursor.execute("SELECT updated_at FROM conversations ORDER BY updated_at DESC LIMIT 1")
    recent_row = cursor.fetchone()
    most_recent = recent_row["updated_at"] if recent_row else None

    conn.close()

    return {
        "total_conversations": total,
        "active_conversations": active,
        "archived_conversations": archived,
        "pinned_conversations": pinned,
        "total_messages": total_messages,
        "average_messages_per_conversation": round(avg_messages, 1),
        "oldest_conversation": oldest,
        "most_recent_activity": most_recent,
    }


def export_conversation(conversation_id: str) -> dict[str, Any] | None:
    """Export a conversation with all its messages."""
    conn = _get_connection()
    cursor = conn.cursor()

    # Get conversation metadata
    cursor.execute(
        "SELECT id, title, created_at, updated_at, preview, is_pinned, is_archived FROM conversations WHERE id = ?",
        (conversation_id,)
    )
    conv_row = cursor.fetchone()

    if not conv_row:
        conn.close()
        return None

    # Get all messages
    cursor.execute(
        "SELECT id, role, content, timestamp FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC",
        (conversation_id,)
    )

    messages = []
    for row in cursor.fetchall():
        messages.append({
            "id": row["id"],
            "role": row["role"],
            "content": row["content"],
            "timestamp": row["timestamp"],
        })

    conn.close()

    return {
        "id": conv_row["id"],
        "title": conv_row["title"],
        "created_at": conv_row["created_at"],
        "updated_at": conv_row["updated_at"],
        "is_pinned": bool(conv_row["is_pinned"]),
        "is_archived": bool(conv_row["is_archived"]),
        "messages": messages,
        "exported_at": datetime.utcnow().isoformat(),
    }


def import_conversation(data: dict[str, Any]) -> str:
    """Import a conversation from exported data. Returns new conversation ID."""
    conn = _get_connection()
    cursor = conn.cursor()

    # Create new conversation with new ID
    conv_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    title = data.get("title", "Imported Conversation")
    created_at = data.get("created_at", now)
    updated_at = data.get("updated_at", now)
    preview = data.get("preview", "")
    is_pinned = 1 if data.get("is_pinned", False) else 0

    cursor.execute(
        "INSERT INTO conversations (id, title, created_at, updated_at, preview, is_pinned, is_archived) VALUES (?, ?, ?, ?, ?, ?, 0)",
        (conv_id, f"[Imported] {title}", created_at, updated_at, preview, is_pinned)
    )

    # Import messages
    for msg in data.get("messages", []):
        msg_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO messages (id, conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)",
            (msg_id, conv_id, msg["role"], msg["content"], msg.get("timestamp", now))
        )

    conn.commit()
    conn.close()

    return conv_id


def search_conversations(query: str, limit: int = 20) -> list[dict[str, Any]]:
    """Search conversations by title or message content."""
    conn = _get_connection()
    cursor = conn.cursor()

    # Search in titles and message content
    cursor.execute(
        """
        SELECT DISTINCT c.id, c.title, c.created_at, c.updated_at, c.preview,
               c.is_pinned, c.is_archived,
               (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
        FROM conversations c
        LEFT JOIN messages m ON c.id = m.conversation_id
        WHERE c.title LIKE ? OR m.content LIKE ?
        ORDER BY c.is_pinned DESC, c.updated_at DESC
        LIMIT ?
        """,
        (f"%{query}%", f"%{query}%", limit)
    )

    conversations = []
    for row in cursor.fetchall():
        conversations.append({
            "id": row["id"],
            "title": row["title"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "preview": row["preview"],
            "is_pinned": bool(row["is_pinned"]),
            "is_archived": bool(row["is_archived"]),
            "message_count": row["message_count"]
        })

    conn.close()
    return conversations


# Message operations
def edit_message(message_id: str, new_content: str) -> bool:
    """Edit a message content."""
    conn = _get_connection()
    cursor = conn.cursor()

    # Get original content if not already edited
    cursor.execute("SELECT content, is_edited, original_content FROM messages WHERE id = ?", (message_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False

    original = row["original_content"] if row["is_edited"] else row["content"]

    cursor.execute(
        "UPDATE messages SET content = ?, is_edited = 1, original_content = ? WHERE id = ?",
        (new_content, original, message_id)
    )

    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return updated


def delete_message(message_id: str) -> bool:
    """Delete a message."""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM messages WHERE id = ?", (message_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def toggle_bookmark_message(message_id: str) -> bool:
    """Toggle bookmark status of a message."""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE messages SET is_bookmarked = NOT is_bookmarked WHERE id = ?",
        (message_id,)
    )
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return updated


def set_message_feedback(message_id: str, feedback: int) -> bool:
    """Set feedback for a message (-1 = negative, 0 = none, 1 = positive)."""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE messages SET feedback = ? WHERE id = ?",
        (feedback, message_id)
    )
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return updated


def get_bookmarked_messages(conversation_id: str | None = None) -> list[dict[str, Any]]:
    """Get all bookmarked messages, optionally filtered by conversation."""
    conn = _get_connection()
    cursor = conn.cursor()

    if conversation_id:
        cursor.execute(
            """
            SELECT m.id, m.conversation_id, m.role, m.content, m.timestamp, m.feedback,
                   c.title as conversation_title
            FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE m.is_bookmarked = 1 AND m.conversation_id = ?
            ORDER BY m.timestamp DESC
            """,
            (conversation_id,)
        )
    else:
        cursor.execute(
            """
            SELECT m.id, m.conversation_id, m.role, m.content, m.timestamp, m.feedback,
                   c.title as conversation_title
            FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE m.is_bookmarked = 1
            ORDER BY m.timestamp DESC
            """
        )

    messages = []
    for row in cursor.fetchall():
        messages.append({
            "id": row["id"],
            "conversation_id": row["conversation_id"],
            "role": row["role"],
            "content": row["content"],
            "timestamp": row["timestamp"],
            "feedback": row["feedback"],
            "conversation_title": row["conversation_title"],
        })

    conn.close()
    return messages


def search_messages_in_conversation(conversation_id: str, query: str) -> list[dict[str, Any]]:
    """Search messages within a specific conversation."""
    conn = _get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, role, content, timestamp, is_bookmarked, feedback, is_edited
        FROM messages
        WHERE conversation_id = ? AND content LIKE ?
        ORDER BY timestamp ASC
        """,
        (conversation_id, f"%{query}%")
    )

    messages = []
    for row in cursor.fetchall():
        messages.append({
            "id": row["id"],
            "role": row["role"],
            "content": row["content"],
            "timestamp": row["timestamp"],
            "is_bookmarked": bool(row["is_bookmarked"]),
            "feedback": row["feedback"],
            "is_edited": bool(row["is_edited"]),
        })

    conn.close()
    return messages


# Conversation system prompt and tags
def update_conversation_system_prompt(conversation_id: str, system_prompt: str) -> bool:
    """Update conversation's custom system prompt."""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE conversations SET system_prompt = ? WHERE id = ?",
        (system_prompt, conversation_id)
    )
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return updated


def get_conversation_system_prompt(conversation_id: str) -> str:
    """Get conversation's custom system prompt."""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT system_prompt FROM conversations WHERE id = ?", (conversation_id,))
    row = cursor.fetchone()
    conn.close()
    return row["system_prompt"] if row else ""


def update_conversation_tags(conversation_id: str, tags: list[str]) -> bool:
    """Update conversation's tags."""
    conn = _get_connection()
    cursor = conn.cursor()
    tags_str = ",".join(tags)
    cursor.execute(
        "UPDATE conversations SET tags = ? WHERE id = ?",
        (tags_str, conversation_id)
    )
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return updated


# Templates
def create_template(name: str, description: str = "", system_prompt: str = "", initial_message: str = "") -> str:
    """Create a new conversation template."""
    conn = _get_connection()
    cursor = conn.cursor()
    template_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    cursor.execute(
        "INSERT INTO templates (id, name, description, system_prompt, initial_message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (template_id, name, description, system_prompt, initial_message, now)
    )

    conn.commit()
    conn.close()
    return template_id


def list_templates() -> list[dict[str, Any]]:
    """List all templates."""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, name, description, system_prompt, initial_message, created_at, usage_count FROM templates ORDER BY usage_count DESC, name ASC"
    )

    templates = []
    for row in cursor.fetchall():
        templates.append({
            "id": row["id"],
            "name": row["name"],
            "description": row["description"],
            "system_prompt": row["system_prompt"],
            "initial_message": row["initial_message"],
            "created_at": row["created_at"],
            "usage_count": row["usage_count"],
        })

    conn.close()
    return templates


def get_template(template_id: str) -> dict[str, Any] | None:
    """Get a specific template."""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, name, description, system_prompt, initial_message, created_at, usage_count FROM templates WHERE id = ?",
        (template_id,)
    )
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "system_prompt": row["system_prompt"],
        "initial_message": row["initial_message"],
        "created_at": row["created_at"],
        "usage_count": row["usage_count"],
    }


def update_template(template_id: str, name: str, description: str, system_prompt: str, initial_message: str) -> bool:
    """Update a template."""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE templates SET name = ?, description = ?, system_prompt = ?, initial_message = ? WHERE id = ?",
        (name, description, system_prompt, initial_message, template_id)
    )
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return updated


def delete_template(template_id: str) -> bool:
    """Delete a template."""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM templates WHERE id = ?", (template_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def increment_template_usage(template_id: str) -> bool:
    """Increment template usage count."""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE templates SET usage_count = usage_count + 1 WHERE id = ?",
        (template_id,)
    )
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return updated


# Settings
def get_setting(key: str, default: str = "") -> str:
    """Get a setting value."""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    return row["value"] if row else default


def set_setting(key: str, value: str) -> bool:
    """Set a setting value."""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        (key, value)
    )
    conn.commit()
    conn.close()
    return True


def get_all_settings() -> dict[str, str]:
    """Get all settings."""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM settings")
    settings = {row["key"]: row["value"] for row in cursor.fetchall()}
    conn.close()
    return settings


def delete_messages_after(conversation_id: str, message_id: str) -> int:
    """Delete all messages after a specific message (for regeneration)."""
    conn = _get_connection()
    cursor = conn.cursor()

    # Get the timestamp of the message
    cursor.execute("SELECT timestamp FROM messages WHERE id = ?", (message_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return 0

    timestamp = row["timestamp"]

    # Delete messages after this timestamp
    cursor.execute(
        "DELETE FROM messages WHERE conversation_id = ? AND timestamp > ?",
        (conversation_id, timestamp)
    )
    deleted_count = cursor.rowcount

    conn.commit()
    conn.close()
    return deleted_count


# Initialize database on module import
init_db()
