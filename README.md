Confluence RAG with Chainlit
================================

This app provides a working RAG (Retrieval-Augmented Generation) chatbot over Confluence using a vector DB (Chroma) and Chainlit UI. It supports configurable OpenAI-compatible LLMs and Confluence, plus shared proxy and SSL options. Chat history is maintained per session, and a "Start New Chat" action is available in the UI.

Features
--------
- Confluence search across all spaces via CQL, fetch and index matching pages on demand.
- Vector store backed by Chroma with persistent storage (`.chroma/`).
- OpenAI-compatible LLM and embeddings with configurable `base_url`, `model`, `embeddings_model`.
- Shared `PROXY_URL` and `DISABLE_SSL` applied to both LLM and Confluence requests.
- Chainlit UI with per-session chat history and a "Start New Chat" action.

Quickstart
----------
1) Install dependencies

```
pip install -r requirements.txt
```

2) Set environment variables (see below). You can copy `.env.example` to `.env` and fill values:

```
cp .env.example .env
```

3) Run the app

```
chainlit run app.py -w
```

Open the provided local URL to chat.

Configuration (env vars)
------------------------

LLM / OpenAI-compatible:
- `OPENAPI_BASE_URL` (or `OPENAI_BASE_URL`): Base URL for your OpenAI-compatible endpoint (e.g., `https://api.openai.com/v1` or your proxy/vLLM/Azure endpoint).
- `API_KEY`: API key for the LLM provider.
- `MODEL_NAME`: Chat model name (e.g., `gpt-4o-mini`).
- `EMBEDDINGS_MODEL_NAME`: Embeddings model (e.g., `text-embedding-3-small`).

 Confluence:
 - `CONFLUENCE_BASE_URL`: Base URL to your Confluence (e.g., `https://your-domain.atlassian.net/wiki`).
 - `CONFLUENCE_ACCESS_TOKEN`: Confluence token.
   - Cloud: Either set `CONFLUENCE_EMAIL` + API token, or put `email:apitoken` directly into `CONFLUENCE_ACCESS_TOKEN` (so you only set two vars: base URL and token).
   - Data Center: Use a PAT as Bearer (no email/username needed), or `CONFLUENCE_USERNAME` + password/PAT for Basic.
 - `CONFLUENCE_EMAIL` (optional): Email for Basic auth (typical for Confluence Cloud API tokens).
 - `CONFLUENCE_USERNAME` (optional): Username for Basic auth (useful for Confluence Data Center when using username + PAT/password).

Networking:
- `PROXY_URL`: HTTP(S) proxy URL applied to both LLM and Confluence clients. Example: `http://user:pass@proxy.yourco.local:8080`.
- `DISABLE_SSL`: `true`/`false`. If `true`, SSL verification is disabled for both clients (use only if you know what you're doing).

RAG options (optional):
- `CHROMA_DIR`: Folder to persist the Chroma DB (default: `.chroma`).
- `MAX_CONFLUENCE_RESULTS`: Max pages from CQL search to index per query (default: `25`).
- `CHUNK_SIZE`: Characters per chunk (default: `1200`).
- `CHUNK_OVERLAP`: Overlap between chunks (default: `150`).
- `TOP_K`: Number of chunks to retrieve for context (default: `6`).

How it works
------------
- On each question, the app searches Confluence across all spaces using CQL for relevant pages.
- It fetches those pages' storage format, converts to text, chunks them, and upserts into Chroma.
- It then performs vector similarity search over the index, builds a context, and asks the LLM to answer.
- The UI maintains chat history for context continuity and offers a "Start New Chat" action to clear history.

Notes
-----
- If your Confluence base URL already ends with `/wiki`, it is respected. Otherwise the app targets `/wiki/rest/api` by default.
- The app uses Chroma’s local persistent client. The `.chroma/` directory will be created in the project root.
- The built-in Chainlit "New chat" button also restarts the session; the action button in the chat is provided for convenience.

Troubleshooting
---------------
- 401/403 from Confluence: Verify `CONFLUENCE_ACCESS_TOKEN` and that it’s a valid PAT with appropriate permissions.
- 302 redirect to `/login.action`: This usually means the REST base URL or auth method is wrong for your site.
  - For Confluence Cloud, use `CONFLUENCE_BASE_URL=https://<your-domain>.atlassian.net/wiki` and set `CONFLUENCE_EMAIL` + `CONFLUENCE_ACCESS_TOKEN` (API token).
  - For Data Center, set `CONFLUENCE_BASE_URL` to your site root (e.g., `https://confluence.yourco.local` or `https://confluence.yourco.local/confluence`). Provide either `CONFLUENCE_USERNAME` + `CONFLUENCE_ACCESS_TOKEN` (password or PAT) for Basic auth, or a valid PAT via Bearer.
  - The client now auto-detects between `/rest/api` and `/wiki/rest/api`, but a misconfigured base or invalid credentials can still cause login redirects.
- SSL errors: Set `DISABLE_SSL=true` or provide a proxy that performs TLS termination. Use only when acceptable in your environment.
- Proxy issues: Ensure `PROXY_URL` is reachable. Both LLM and Confluence HTTP clients use it.
- Model or embeddings errors: Ensure `MODEL_NAME` and `EMBEDDINGS_MODEL_NAME` are supported by your LLM endpoint.
