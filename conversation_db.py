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
            preview TEXT DEFAULT ''
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
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        )
    """)

    # Create index for faster queries
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_messages_conversation
        ON messages(conversation_id)
    """)

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


def list_conversations(limit: int = 50) -> list[dict[str, Any]]:
    """List all conversations ordered by most recent."""
    conn = _get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT c.id, c.title, c.created_at, c.updated_at, c.preview,
               (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
        FROM conversations c
        ORDER BY c.updated_at DESC
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


# Initialize database on module import
init_db()
