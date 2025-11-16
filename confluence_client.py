from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Optional, Tuple

import httpx
from bs4 import BeautifulSoup

from config import Settings


class ConfluenceClient:
    def __init__(self, cfg: Settings):
        self.cfg = cfg
        self.last_cql: Optional[str] = None
        if not cfg.confluence_base_url:
            raise ValueError("CONFLUENCE_BASE_URL is required")
        if not cfg.confluence_access_token:
            raise ValueError("CONFLUENCE_ACCESS_TOKEN is required")

        base_url = cfg.confluence_base_url.rstrip("/")

        proxy = None
        if cfg.proxy_url:
            proxy = cfg.proxy_url

        headers = {
            "Accept": "application/json",
        }
        auth: Optional[Tuple[str, str]] = None
        # Prefer Basic auth if email or username provided
        if cfg.confluence_email:
            auth = (cfg.confluence_email, cfg.confluence_access_token)  # type: ignore[assignment]
        elif cfg.confluence_username:
            auth = (cfg.confluence_username, cfg.confluence_access_token)  # type: ignore[assignment]
        elif ":" in (cfg.confluence_access_token or ""):
            # Allow providing "email:token" as the access token to avoid a separate email var
            user, tok = (cfg.confluence_access_token or "").split(":", 1)
            auth = (user, tok)  # type: ignore[assignment]
        else:
            # Fallback to Bearer (Data Center PATs)
            headers["Authorization"] = f"Bearer {cfg.confluence_access_token}"

        # Discover a working REST API base to avoid 302 to /login.action
        api_base = self._discover_api_base(base_url, headers, auth, proxy, not cfg.disable_ssl)
        self.api_base = api_base

        self.client = httpx.Client(
            base_url=self.api_base,
            headers=headers,
            auth=auth,
            verify=not cfg.disable_ssl,
            proxy=proxy,
            timeout=httpx.Timeout(30.0, connect=30.0, read=30.0),
            follow_redirects=False,
        )

        # Keep full site base to craft page URLs based on detected API base
        # If API base is .../X/rest/api then site base is .../X
        if self.api_base.endswith("/rest/api"):
            self.site_base = self.api_base[: -len("/rest/api")]  # strip suffix
        else:
            self.site_base = base_url

    def _discover_api_base(
        self,
        base_url: str,
        headers: Dict[str, str],
        auth: Optional[Tuple[str, str]],
        proxy: Optional[str],
        verify: bool,
    ) -> str:
        # If user already points to a REST API base, respect it
        if base_url.endswith("/rest/api"):
            return base_url

        candidates: List[str] = []
        # Common forms across Cloud and Data Center
        candidates.append(f"{base_url}/rest/api")
        candidates.append(f"{base_url}/wiki/rest/api")

        # Try each candidate with a lightweight call that exists on all editions
        tmp = httpx.Client(headers=headers, auth=auth, verify=verify, proxy=proxy, timeout=10.0, follow_redirects=False)
        try:
            for cand in candidates:
                try:
                    r = tmp.get(f"{cand}/space", params={"limit": 1})
                    # Avoid login redirects which show up as 302 to /login.action
                    if r.is_redirect:
                        loc = r.headers.get("Location", "")
                        if "login.action" in loc or "/login" in loc:
                            continue
                    # Consider 200/401/403 as acceptable indicators that the endpoint exists
                    if r.status_code in (200, 401, 403):
                        return cand
                except httpx.HTTPError:
                    continue
        finally:
            tmp.close()

        # Heuristic fallback if nothing matched
        # Cloud domains typically use /wiki/rest/api
        if ".atlassian.net" in base_url:
            return f"{base_url}/wiki/rest/api"
        # Otherwise default to /rest/api (Data Center)
        return f"{base_url}/rest/api"

    def _ensure_ok(self, r: httpx.Response):
        if r.is_redirect:
            loc = r.headers.get("Location", "")
            if "login.action" in loc or "/login" in loc:
                raise RuntimeError(
                    f"Confluence redirected to login ({loc}). Check base URL and credentials. "
                    f"If using Data Center, set CONFLUENCE_BASE_URL to your site root (e.g., https://host or https://host/confluence) "
                    f"and use CONFLUENCE_USERNAME + CONFLUENCE_ACCESS_TOKEN or a valid PAT."
                )
            raise RuntimeError(f"Unexpected redirect {r.status_code} to {loc}")
        r.raise_for_status()

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
        cql_filters: List[str] = ["type = page"]
        cql_filters.append(f"(title ~ '{q}' OR text ~ '{q}')")
        # Optional space filters
        spaces = getattr(self.cfg, "confluence_spaces", None)
        if spaces:
            items = ", ".join([f"'{s.replace("'", "\\'")}'" for s in spaces])
            cql_filters.append(f"space in ({items})")
        # Optional label filters
        labels = getattr(self.cfg, "confluence_labels", None)
        if labels:
            items = ", ".join([f"'{s.replace("'", "\\'")}'" for s in labels])
            cql_filters.append(f"label in ({items})")
        cql = " AND ".join(cql_filters) + " ORDER BY lastmodified DESC"
        self.last_cql = cql
        params = {"cql": cql, "limit": min(limit, 100), "expand": "space,content.metadata"}
        r = self.client.get("/search", params=params)
        self._ensure_ok(r)
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
        self._ensure_ok(r)
        return r.json()

    @staticmethod
    def storage_to_text(storage_html: str) -> str:
        # Convert Confluence storage format (XHTML) to readable text
        # Remove code macro metadata and unwanted tags
        soup = BeautifulSoup(storage_html, "html.parser")
        # Replace <ac:structured-macro> etc. with their text
        # Match namespaced Confluence tags like ac:* and ri:* and unwrap them
        for macro in soup.find_all(re.compile(r"^(ac:|ri:)") ):  # Namespace tags
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
