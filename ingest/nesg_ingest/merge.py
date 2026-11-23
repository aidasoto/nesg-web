"""Deduplicación, enlazado con el contenido editorial, overrides y estadísticas."""

from __future__ import annotations

import re
from collections import Counter
from datetime import datetime, timezone

from .normalize import slugify, strip_doi, title_key
from .roster import Roster

TYPE_RANK = {"journal-article": 0, "conference-paper": 1, "book-chapter": 2, "book": 2, "thesis": 3, "dataset": 4, "other": 5, "preprint": 6}


def _richness(r: dict) -> int:
    return sum(bool(r.get(k)) for k in ("abstract", "venue", "doi", "date")) + len(r.get("links", {}))


def dedupe(records: list[dict]) -> list[dict]:
    """1) por DOI; 2) por título normalizado + año ±1 (preprint ↔ versión publicada).

    Se conserva la versión "mejor" (artículo > preprint, más metadatos) y se
    heredan enlaces abiertos de la descartada.
    """
    by_doi: dict[str, dict] = {}
    no_doi: list[dict] = []
    for r in records:
        if r.get("doi"):
            prev = by_doi.get(r["doi"])
            by_doi[r["doi"]] = r if prev is None or _richness(r) > _richness(prev) else prev
        else:
            no_doi.append(r)

    groups: dict[str, list[dict]] = {}
    for r in [*by_doi.values(), *no_doi]:
        groups.setdefault(title_key(r["title"]), []).append(r)

    out = []
    for group in groups.values():
        group.sort(key=lambda r: (TYPE_RANK.get(r["type"], 9), -_richness(r)))
        keep, *rest = group
        for other in rest:
            if keep["year"] and other["year"] and abs(keep["year"] - other["year"]) > 1:
                out.append(other)  # mismo título pero trabajo distinto
                continue
            for k, v in other.get("links", {}).items():
                keep["links"].setdefault("oa" if k == "doi" else k, v)
            keep["citations"] = max(keep["citations"], other["citations"])
            keep["openAccess"] = keep["openAccess"] or other["openAccess"]
        out.append(keep)
    return out


def link(records: list[dict], roster: Roster, author_map: dict[str, str]) -> None:
    """Autores → personas, papers → proyectos (por grant ID) y → líneas."""
    by_orcid = {p.orcid: p.id for p in roster.people if p.orcid}
    by_oa = {p.openalex: p.id for p in roster.people if p.openalex}
    by_oa.update(author_map)
    grant_to_project = {_norm_grant(g): pr for pr in roster.projects for g in pr.grant_ids}

    for r in records:
        ids = r.get("_author_ids") or [None] * len(r["authors"])
        for a, oa_id in zip(r["authors"], ids):
            a["person"] = a.get("person") or by_orcid.get(a.get("orcid")) or by_oa.get(oa_id)

        projects = set(r.get("projects", []))
        for g in r.get("_grants", []):
            pr = grant_to_project.get(_norm_grant(g))
            if pr:
                projects.add(pr.id)
        r["projects"] = sorted(projects)

        # Líneas: heredadas de los proyectos + coincidencia de palabras clave
        lines = set(r.get("lines", []))
        proj_by_id = {p.id: p for p in roster.projects}
        for pid in r["projects"]:
            lines.update(proj_by_id[pid].lines)
        haystack = " ".join([r["title"], r.get("abstract") or "", *r.get("_topics", [])]).lower()
        for line in roster.lines:
            if any(kw.lower() in haystack for kw in line.keywords):
                lines.add(line.id)
        r["lines"] = sorted(lines)


def _norm_grant(g: str) -> str:
    return re.sub(r"[^a-z0-9]", "", g.lower())


def _matches(r: dict, key: str) -> bool:
    key = str(key)
    return key.lower() == (r.get("openalex") or "").lower() or strip_doi(key) == r.get("doi")


def apply_overrides(records: list[dict], ov: dict) -> list[dict]:
    excluded = [str(k) for k in ov.get("exclude") or []]
    records = [r for r in records if not any(_matches(r, k) for k in excluded)]
    for key, patch in (ov.get("patch") or {}).items():
        for r in records:
            if _matches(r, key):
                patch = dict(patch)
                r["links"].update(patch.pop("links", {}))
                r.update(patch)
    for m in ov.get("manual") or []:
        rec = {"date": None, "venue": None, "publisher": None, "abstract": None, "doi": None, "openalex": None,
               "lines": [], "projects": [], "links": {}, "citations": 0, "openAccess": False, **m}
        rec["authors"] = [{"orcid": None, "person": None, **a} for a in rec.get("authors", [])]
        records.append(rec)
    return records


def keep_group_only(records: list[dict]) -> list[dict]:
    """Descarta lo que no tenga al menos un autor del grupo (tras overrides)."""
    return [r for r in records if any(a.get("person") for a in r["authors"])]


def assign_ids(records: list[dict]) -> None:
    """Slug legible y estable: <año>-<primeras palabras del título>[-n]."""
    records.sort(key=lambda r: (r.get("doi") or r.get("openalex") or r["title"]))
    seen: Counter[str] = Counter()
    for r in records:
        base = r.pop("slug", None) or f"{r['year']}-{slugify(r['title'])}"
        seen[base] += 1
        r["id"] = base if seen[base] == 1 else f"{base}-{seen[base]}"


def finalize(records: list[dict]) -> list[dict]:
    for r in records:
        for k in [k for k in r if k.startswith("_")]:
            del r[k]
    records.sort(key=lambda r: (r.get("date") or f"{r['year']}-00-00", r["id"]), reverse=True)
    return records


def stats(records: list[dict]) -> dict:
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "total": len(records),
        "citations": sum(r["citations"] for r in records),
        "openAccess": sum(r["openAccess"] for r in records),
        "byYear": dict(sorted(Counter(r["year"] for r in records).items())),
        "byType": dict(Counter(r["type"] for r in records).most_common()),
        "byLine": dict(Counter(l for r in records for l in r["lines"]).most_common()),
        "byPerson": dict(Counter(a["person"] for r in records for a in r["authors"] if a["person"]).most_common()),
    }
