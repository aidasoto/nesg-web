"""Fuentes complementarias (STUBS, pendientes de implementar).

- ORCID público: https://pub.orcid.org/v3.0/{orcid}/works
  → lista de DOIs declarados por el investigador. Sirve para detectar papers que
    OpenAlex no ha atribuido bien (se piden luego por DOI a OpenAlex/Crossref).
- Crossref: https://api.crossref.org/works/{doi}
  → completar venue/editorial/abstract cuando OpenAlex no los trae.
- DBLP: https://dblp.org/pid/{pid}.xml
  → muy buena cobertura de congresos de informática (tipo conference-paper).
- Semantic Scholar: https://api.semanticscholar.org/graph/v1/paper/DOI:{doi}
  → abstracts y enlaces a PDF abiertos.
- Scopus / WoS: solo con clave institucional (cuartiles, métricas oficiales).
- Google Scholar: SIN API oficial; no se hace scraping (frágil y contra sus ToS).
"""

from __future__ import annotations


def orcid_dois(orcid: str) -> set[str]:
    """TODO: devolver los DOIs declarados en el perfil ORCID público."""
    return set()


def crossref_enrich(record: dict) -> dict:
    """TODO: rellenar campos vacíos (venue, publisher, abstract) desde Crossref."""
    return record
