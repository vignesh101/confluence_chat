from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Optional, Tuple

import httpx
from bs4 import BeautifulSoup

from config import Settings


class ConfluenceClient:
    def __init__(self, cfg: Settings):
        if not cfg.confluence_base_url:
            raise ValueError("CONFLUENCE_BASE_URL is required")
        if not cfg.confluence_access_token:
            raise ValueError("CONFLUENCE_ACCESS_TOKEN is required")

        base_url = cfg.confluence_base_url.rstrip("/")

        # Confluence Cloud typically uses /wiki prefix for REST routes; allow either form
        self.api_base = f"{base_url}/rest/api" if base_url.endswith("/wiki") else f"{base_url}/wiki/rest/api"

        proxies = None
        if cfg.proxy_url:
            proxies = {"http://": cfg.proxy_url, "https://": cfg.proxy_url}
        headers = {"Accept": "application/json"}
        auth = None
        # Prefer Basic auth if email provided (typical for Confluence Cloud API tokens)
        if cfg.confluence_email:
            auth = (cfg.confluence_email, cfg.confluence_access_token)  # type: ignore[assignment]
        else:
            headers["Authorization"] = f"Bearer {cfg.confluence_access_token}"

        self.client = httpx.Client(
            base_url=self.api_base,
            headers=headers,
            auth=auth,
            verify=not cfg.disable_ssl,
            proxies=proxies,
            timeout=httpx.Timeout(30.0, connect=30.0, read=30.0),
        )

        # Keep full site base to craft page URLs
        self.site_base = base_url if base_url.endswith("/wiki") else f"{base_url}/wiki"

    def _page_web_url(self, page: Dict[str, Any]) -> str:
        # Prefer _links.webui if present
        webui = page.get("_links", {}).get("webui")
        if webui:
            return f"{self.site_base}{webui}"
        # Fallback to canonical URL format
        page_id = page.get("id")
        return f"{self.site_base}/pages/{page_id}"

    def search_pages(self, query: str, limit: int = 25) -> List[Dict[str, Any]]:
        # CQL search across all spaces and page types
        # Escaping single quotes in query for CQL
        q = query.replace("'", "\\'")
        cql = f"type = page AND (title ~ '{q}' OR text ~ '{q}') ORDER BY lastmodified DESC"
        params = {"cql": cql, "limit": min(limit, 100), "expand": "space,content.metadata"}
        r = self.client.get("/search", params=params)
        r.raise_for_status()
        data = r.json()
        results = data.get("results", [])
        pages: List[Dict[str, Any]] = []
        for it in results:
            content = it.get("content") or {}
            if content.get("type") != "page":
                continue
            page = {
                "id": content.get("id"),
                "title": content.get("title"),
                "space": (content.get("space") or {}).get("key"),
                "_links": content.get("_links") or it.get("_links", {}),
            }
            page["url"] = self._page_web_url({**page, "_links": page.get("_links", {})})
            pages.append(page)
        return pages

    def get_page_storage(self, page_id: str) -> Dict[str, Any]:
        r = self.client.get(f"/content/{page_id}", params={"expand": "body.storage,space"})
        r.raise_for_status()
        return r.json()

    @staticmethod
    def storage_to_text(storage_html: str) -> str:
        # Convert Confluence storage format (XHTML) to readable text
        # Remove code macro metadata and unwanted tags
        soup = BeautifulSoup(storage_html, "html.parser")
        # Replace <ac:structured-macro> etc. with their text
        for macro in soup.find_all(re.compile(r"^(ac:|ri:)"):  # Namespace tags
            macro.unwrap()
        text = soup.get_text("\n")
        # Normalize whitespace
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r"[\t\x0b\x0c\r]", " ", text)
        return text.strip()

    def get_page_text(self, page_id: str) -> Tuple[str, Dict[str, Any]]:
        data = self.get_page_storage(page_id)
        storage_html = (data.get("body", {}).get("storage", {}) or {}).get("value", "")
        text = self.storage_to_text(storage_html)
        meta = {
            "id": data.get("id"),
            "title": data.get("title"),
            "space": (data.get("space") or {}).get("key"),
        }
        return text, meta
