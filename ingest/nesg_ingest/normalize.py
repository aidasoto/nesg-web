"""Convierte un work de OpenAlex al esquema de `publications` (src/content.config.ts).

Los campos que empiezan por "_" son internos (para enlazar y clasificar) y se
eliminan antes de escribir el JSON.
"""

from __future__ import annotations

import re
import unicodedata


def strip_orcid(v: str | None) -> str | None:
    return v.rsplit("/", 1)[-1] if v else None


def strip_doi(v: str | None) -> str | None:
    if not v:
        return None
    return re.sub(r"^https?://(dx\.)?doi\.org/", "", v.strip(), flags=re.I).lower()


def strip_openalex(v: str | None) -> str | None:
    return v.rsplit("/", 1)[-1] if v else None


def slugify(text: str, max_words: int = 7) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    words = re.findall(r"[a-z0-9]+", text.lower())
    stop = {"a", "an", "the", "of", "for", "and", "in", "on", "to", "with", "de", "la", "el", "y", "en"}
    words = [w for w in words if w not in stop] or words
    return "-".join(words[:max_words])


def title_key(title: str) -> str:
    """Clave para deduplicar versiones (preprint vs publicado) con distinto DOI."""
    return slugify(title, max_words=50)


def _abstract(inv: dict | None) -> str | None:
    if not inv:
        return None
    pos = [(i, w) for w, idxs in inv.items() for i in idxs]
    return " ".join(w for _, w in sorted(pos)) or None


def _type(work: dict) -> str:
    t = work.get("type") or "other"
    src_type = ((work.get("primary_location") or {}).get("source") or {}).get("type")
    if t == "article" and src_type == "conference":
        return "conference-paper"
    return {
        "article": "journal-article",
        "review": "journal-article",
        "proceedings-article": "conference-paper",
        "conference-paper": "conference-paper",
        "book-chapter": "book-chapter",
        "book": "book",
        "preprint": "preprint",
        "posted-content": "preprint",
        "dissertation": "thesis",
        "dataset": "dataset",
    }.get(t, "other")


def _grant_ids(work: dict) -> list[str]:
    ids = [g.get("award_id") for g in work.get("grants") or []]
    # Esquema nuevo de OpenAlex (awards); se aceptan ambos.
    ids += [a.get("funder_award_id") for a in work.get("awards") or []]
    return [i for i in ids if i]


def from_openalex(work: dict) -> dict:
    loc = work.get("primary_location") or {}
    src = loc.get("source") or {}
    oa = work.get("open_access") or {}
    doi = strip_doi(work.get("doi"))
    links: dict[str, str] = {}
    if doi:
        links["doi"] = f"https://doi.org/{doi}"
    if loc.get("pdf_url"):
        links["pdf"] = loc["pdf_url"]
    if oa.get("oa_url") and oa.get("oa_url") != links.get("pdf"):
        links["oa"] = oa["oa_url"]

    authors, author_ids = [], []
    for a in work.get("authorships") or []:
        au = a.get("author") or {}
        authors.append({"name": au.get("display_name") or a.get("raw_author_name") or "?", "orcid": strip_orcid(au.get("orcid")), "person": None})
        author_ids.append(strip_openalex(au.get("id")))

    title = work.get("display_name") or work.get("title") or "(untitled)"
    return {
        "title": title,
        "year": work.get("publication_year"),
        "date": work.get("publication_date"),
        "type": _type(work),
        "venue": src.get("display_name"),
        "publisher": src.get("host_organization_name"),
        "abstract": _abstract(work.get("abstract_inverted_index")),
        "authors": authors,
        "doi": doi,
        "openalex": strip_openalex(work.get("id")),
        "lines": [],
        "projects": [],
        "links": links,
        "citations": work.get("cited_by_count") or 0,
        "openAccess": bool(oa.get("is_oa")),
        # internos
        "_author_ids": author_ids,
        "_grants": _grant_ids(work),
        "_topics": [t.get("display_name", "") for t in (work.get("topics") or [])]
        + [k.get("display_name", "") for k in (work.get("keywords") or [])],
        "_src_type": work.get("type"),
    }
