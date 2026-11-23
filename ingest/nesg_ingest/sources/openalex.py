"""Fuente principal: OpenAlex (gratuita, sin clave).

Docs: https://docs.openalex.org/api-entities/works
Devuelve los works crudos de OpenAlex; la normalización está en normalize.py.
"""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from collections.abc import Iterator

API = "https://api.openalex.org/works"
USER_AGENT = "nesg-web-ingest/0.1"


def _get(url: str, retries: int = 3) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(2**attempt)
    raise RuntimeError("unreachable")


def fetch_works(author_filter: str, *, from_date: str, mailto: str = "", ror: str | None = None) -> Iterator[dict]:
    """Itera todos los works que cumplen `author_filter` con paginación por cursor.

    author_filter: p. ej. "author.orcid:0000-0002-1825-0097" o "author.id:A5000000000"
    """
    filters = [author_filter, f"from_publication_date:{from_date}"]
    if ror:
        filters.append(f"institutions.ror:{ror}")
    cursor = "*"
    while cursor:
        params = {"filter": ",".join(filters), "per-page": "200", "cursor": cursor}
        if mailto:
            params["mailto"] = mailto
        data = _get(f"{API}?{urllib.parse.urlencode(params)}")
        yield from data.get("results", [])
        cursor = data.get("meta", {}).get("next_cursor")
        time.sleep(0.1)  # cortesía: < 10 req/s


def fetch_by_doi(doi: str, *, mailto: str = "") -> dict | None:
    url = f"{API}/https://doi.org/{urllib.parse.quote(doi)}"
    if mailto:
        url += f"?mailto={urllib.parse.quote(mailto)}"
    try:
        return _get(url)
    except Exception:
        return None
