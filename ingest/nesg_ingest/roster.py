"""Lee el contenido editorial del sitio (personas, proyectos, líneas).

La ingesta no mantiene su propia lista de investigadores: la fuente de verdad
es src/content/, igual que para la web.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import yaml


@dataclass
class Person:
    id: str
    name: str
    orcid: str | None
    openalex: str | None


@dataclass
class Project:
    id: str
    lines: list[str]
    grant_ids: list[str]


@dataclass
class Line:
    id: str
    keywords: list[str] = field(default_factory=list)


@dataclass
class Roster:
    people: list[Person]
    projects: list[Project]
    lines: list[Line]


def _load_dir(path: Path) -> list[tuple[str, dict]]:
    out = []
    for f in sorted(path.glob("*.yaml")):
        out.append((f.stem, yaml.safe_load(f.read_text(encoding="utf-8")) or {}))
    return out


def load_roster(content_dir: Path) -> Roster:
    people = [
        Person(
            id=pid,
            name=d["name"],
            orcid=d.get("orcid"),
            openalex=d.get("openalex"),
        )
        for pid, d in _load_dir(content_dir / "people")
    ]
    projects = [
        Project(id=pid, lines=d.get("lines", []), grant_ids=[str(g) for g in d.get("grantIds", [])])
        for pid, d in _load_dir(content_dir / "projects")
    ]
    lines = [Line(id=lid, keywords=d.get("keywords", [])) for lid, d in _load_dir(content_dir / "lines")]
    return Roster(people=people, projects=projects, lines=lines)
