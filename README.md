# Confluence Chat - Professional React UI

A modern, industry-standard RAG (Retrieval-Augmented Generation) chatbot for Confluence with a professional React-based user interface. Features real-time streaming responses, conversation management, source citations, and dark mode support.

## Features

### Chat Interface
- **Professional React UI** with TypeScript and Tailwind CSS
- **Real-time streaming responses** via WebSocket for instant feedback
- **Markdown rendering** with syntax highlighting for code blocks
- **Dark/Light mode** support with system preference detection
- **Responsive design** that works on desktop and mobile
- **Source citations** with clickable links to Confluence pages
- **Query debug information** showing retrieval details (optional)

### Conversation Management
- **Persistent conversation history** with SQLite storage
- **Sidebar navigation** for browsing past conversations
- **Search conversations** by title
- **Rename and delete** conversations
- **Auto-generated titles** from first user message

### RAG Pipeline
- **Smart Confluence search** using CQL across all spaces
- **Vector similarity search** with FAISS for fast retrieval
- **Multi-query expansion** for improved recall
- **MMR (Maximal Marginal Relevance)** selection for diverse results
- **Per-page chunk caps** to reduce redundancy
- **Context budget enforcement** to optimize prompt size
- **Inline citations** with numbered references

## Architecture

```
┌─────────────┐     WebSocket      ┌─────────────┐
│  React UI   │ ◄─────────────────►│   FastAPI   │
│  (TypeScript)│                    │   Backend   │
└─────────────┘                    └─────────────┘
                                          │
                                          ▼
                               ┌─────────────────────┐
                               │    RAG Pipeline     │
                               ├─────────────────────┤
                               │ • Confluence Client │
                               │ • FAISS Vector Store│
                               │ • LLM Client        │
                               │ • SQLite DB         │
                               └─────────────────────┘
```

## Quick Start

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

### 3. Configure Environment Variables

Copy the example environment file and edit with your settings:

```bash
cp .env.example .env
```

Required variables:
- `API_KEY` - Your OpenAI API key (or compatible provider)
- `CONFLUENCE_BASE_URL` - Your Confluence instance URL
- `CONFLUENCE_ACCESS_TOKEN` - Confluence API token

### 4. Run the Application

**Development mode (recommended for development):**

```bash
python run.py
```

This starts both:
- Backend API: http://localhost:8000
- Frontend: http://localhost:3000

**Or run separately:**

Backend:
```bash
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

Frontend:
```bash
cd frontend
npm run dev
```

### 5. Production Build

Build the frontend for production:

```bash
cd frontend
npm run build
```

Then run only the backend, which will serve the built React app:

```bash
uvicorn api:app --host 0.0.0.0 --port 8000
```

Access at http://localhost:8000

## Configuration

### Environment Variables

#### LLM / OpenAI-Compatible

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_BASE_URL` | Base URL for OpenAI-compatible API | OpenAI default |
| `API_KEY` | API key for the LLM provider | **Required** |
| `MODEL_NAME` | Chat model name | `gpt-4o-mini` |
| `EMBEDDINGS_MODEL_NAME` | Embeddings model | `text-embedding-3-small` |
| `TEMPERATURE` | Generation temperature | `0.2` |

#### Confluence

| Variable | Description | Default |
|----------|-------------|---------|
| `CONFLUENCE_BASE_URL` | Base URL for Confluence | **Required** |
| `CONFLUENCE_ACCESS_TOKEN` | API token (or `email:token` format) | **Required** |
| `CONFLUENCE_EMAIL` | Email for Basic auth (Cloud) | Optional |
| `CONFLUENCE_USERNAME` | Username for Basic auth (Data Center) | Optional |
| `CONFLUENCE_SPACES` | Comma-separated space keys to search | All spaces |
| `CONFLUENCE_LABELS` | Comma-separated required labels | None |

#### Networking

| Variable | Description | Default |
|----------|-------------|---------|
| `PROXY_URL` | HTTP(S) proxy URL | None |
| `DISABLE_SSL` | Disable SSL verification | `false` |

#### RAG Options

| Variable | Description | Default |
|----------|-------------|---------|
| `FAISS_DIR` | Directory for FAISS index | `.faiss` |
| `CHUNK_SIZE` | Characters per chunk | `1500` |
| `CHUNK_OVERLAP` | Overlap between chunks | `200` |
| `TOP_K` | Chunks to retrieve | `8` |
| `MAX_CHUNKS_PER_PAGE` | Max chunks per page in context | `3` |
| `MAX_CONTEXT_CHARS` | Max total context characters | `16000` |
| `USE_MULTI_QUERY` | Enable query expansion | `true` |
| `NUM_QUERY_VARIANTS` | Number of query variants | `3` |
| `MMR_LAMBDA` | MMR diversity factor (0-1) | `0.6` |
| `MAX_HISTORY_TURNS` | Conversation history length | `10` |
| `SHOW_QUERY_DETAILS` | Show retrieval debug info | `false` |
| `MAX_CONFLUENCE_SEARCH_RESULTS` | Max pages to search | `30` |

## UI Features

### Chat Interface
- **Type your question** in the input area at the bottom
- **Press Enter** to send (Shift+Enter for new line)
- **Real-time streaming** shows the response as it generates
- **Copy button** to copy assistant responses
- **Expandable debug info** when `SHOW_QUERY_DETAILS=true`

### Sidebar
- **New Conversation** button to start fresh
- **Search** to filter conversations by title
- **Click** to load a conversation
- **Hover** to see edit/delete options
- **Collapse** sidebar with the arrow button

### Theme Switcher
- Click the sun/moon icon in the header
- Choose Light, Dark, or System preference

## API Endpoints

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/conversations` | Create conversation |
| `GET` | `/api/conversations` | List all conversations |
| `GET` | `/api/conversations/{id}/messages` | Get conversation messages |
| `PUT` | `/api/conversations/{id}` | Update conversation title |
| `DELETE` | `/api/conversations/{id}` | Delete conversation |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `ws://host/ws/chat` | Real-time chat with streaming |

Message format:
```json
{
  "conversation_id": 1,
  "content": "How do I deploy?",
  "history": [{"role": "user", "content": "..."}, ...]
}
```

Response types:
- `status` - Progress updates
- `token` - Streamed response tokens
- `sources` - Source citations
- `debug` - Query debug information
- `complete` - Response complete
- `error` - Error message

## Technology Stack

### Backend
- **FastAPI** - Modern async Python web framework
- **WebSocket** - Real-time bidirectional communication
- **FAISS** - Efficient vector similarity search
- **SQLite** - Lightweight conversation persistence
- **OpenAI Python SDK** - LLM client with streaming support
- **Pydantic** - Data validation and settings management

### Frontend
- **React 18** - UI library with hooks
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **React Markdown** - Markdown rendering with GFM support
- **Highlight.js** - Syntax highlighting
- **Lucide React** - Beautiful icons
- **date-fns** - Date formatting

## Troubleshooting

### Connection Issues
- **WebSocket disconnected**: Check if the backend is running
- **CORS errors**: The backend allows all origins in development
- **Proxy issues**: Ensure `PROXY_URL` is reachable

### Confluence Issues
- **401/403**: Check your `CONFLUENCE_ACCESS_TOKEN`
- **302 redirect**: Wrong base URL or auth method
- **No results**: Check `CONFLUENCE_SPACES` filter or search terms

### Performance Issues
- **Slow responses**: Reduce `MAX_CONFLUENCE_SEARCH_RESULTS` or `TOP_K`
- **Memory usage**: FAISS index grows with indexed content
- **Token limits**: Adjust `MAX_CONTEXT_CHARS` for your model

## Development

### Frontend Development

```bash
cd frontend
npm run dev      # Start dev server with hot reload
npm run build    # Build for production
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

### Backend Development

```bash
uvicorn api:app --reload  # Auto-reload on code changes
```

### Adding Features

The codebase is modular:
- `api.py` - FastAPI routes and WebSocket handler
- `rag.py` - RAG pipeline logic
- `confluence_client.py` - Confluence API integration
- `vector_store.py` - FAISS vector store wrapper
- `llm.py` - LLM client wrapper
- `conversation_db.py` - SQLite conversation storage
- `frontend/src/` - React components and hooks

## Migration from Chainlit

This version replaces the Chainlit UI with a custom React application. Key differences:

1. **No Chainlit dependency** - Uses FastAPI + React instead
2. **WebSocket streaming** - Direct control over response streaming
3. **Custom UI** - Full control over appearance and behavior
4. **Conversation management** - Built-in sidebar with search/rename/delete
5. **Theme support** - Dark/light mode with system preference detection

The RAG pipeline, Confluence integration, and conversation database remain the same.

## License

MIT License
