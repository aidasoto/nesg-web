"""nesg-ingest: fuentes → publications.json + stats.json

Uso (desde la raíz del repo):
    pnpm ingest            # consulta OpenAlex con los ORCID de src/content/people
    pnpm ingest:offline    # reutiliza la última descarga (ingest/.cache/), sin red
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import yaml

from . import merge
from .normalize import from_openalex
from .roster import load_roster
from .sources import openalex

ROOT = Path(__file__).resolve().parents[2]
INGEST = ROOT / "ingest"
CONTENT = ROOT / "src" / "content"
OUT = ROOT / "data"


def collect_online(roster, cfg: dict) -> list[dict]:
    ror = cfg.get("ror") if cfg.get("filter_by_institution") else None
    raw: list[dict] = []
    for p in roster.people:
        if p.orcid:
            flt = f"author.orcid:{p.orcid}"
        elif p.openalex:
            flt = f"author.id:{p.openalex}"
        else:
            print(f"  ! {p.id}: sin ORCID ni id de OpenAlex, se omite", file=sys.stderr)
            continue
        works = list(openalex.fetch_works(flt, from_date=cfg["from_date"], mailto=cfg.get("mailto", ""), ror=ror))
        print(f"  {p.id}: {len(works)} works")
        raw.extend(works)
    return raw


CACHE = INGEST / ".cache" / "openalex_raw.json"


def collect_offline() -> list[dict]:
    if not CACHE.exists():
        sys.exit("No hay caché: ejecuta antes `pnpm ingest` con red.")
    return json.loads(CACHE.read_text(encoding="utf-8"))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--offline", action="store_true", help="reprocesar la última descarga sin red (útil al tocar overrides)")
    ap.add_argument("--dry-run", action="store_true", help="no escribir ficheros")
    args = ap.parse_args()

    cfg = yaml.safe_load((INGEST / "config.yaml").read_text(encoding="utf-8"))
    overrides = yaml.safe_load((INGEST / "overrides.yaml").read_text(encoding="utf-8")) or {}
    roster = load_roster(CONTENT)

    print("Descargando…" if not args.offline else "Modo offline (caché)…")
    if args.offline:
        raw = collect_offline()
    else:
        raw = collect_online(roster, cfg)
        CACHE.parent.mkdir(exist_ok=True)
        CACHE.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")

    excluded_types = set(cfg.get("exclude_types", []))
    records = [from_openalex(w) for w in raw if w.get("type") not in excluded_types]
    n_raw = len(records)
    records = merge.dedupe(records)
    merge.link(records, roster, overrides.get("authors") or {})
    records = merge.apply_overrides(records, overrides)
    records = merge.keep_group_only(records)
    merge.assign_ids(records)
    records = merge.finalize(records)
    st = merge.stats(records)

    print(f"{n_raw} works → {len(records)} publicaciones tras deduplicar/filtrar")
    unlinked = [r["id"] for r in records if not r["lines"]]
    if unlinked:
        print(f"  ! {len(unlinked)} sin línea de investigación (revisar keywords o overrides.patch):")
        for i in unlinked[:20]:
            print(f"    - {i}")

    if args.dry_run:
        return
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "publications.json").write_text(json.dumps(records, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (OUT / "stats.json").write_text(json.dumps(st, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Escrito {OUT.relative_to(ROOT)}/publications.json y stats.json")


if __name__ == "__main__":
    main()
