# NESG web

Web del Network Engineering & Security Group (UGR). Sitio **100 % estático**: la
automatización ocurre en el build, no en el servidor.

```
OpenAlex/ORCID… ──► ingest/ (Python, uv) ──► data/*.json ──► Astro build ──► dist/ ──► nginx/Caddy
                     + overrides.yaml          publications.json            + Pagefind
                                               stats.json
```

Referencia funcional: *Propuesta de Arquitectura y Estructuración Web – NESG* + diagrama de sitemap.

## Uso

```sh
pnpm install
pnpm ingest           # consulta OpenAlex con los ORCID de src/content/people (y guarda caché)
pnpm ingest:offline   # reprocesa la última descarga sin red (tras tocar overrides/keywords)
pnpm dev              # http://localhost:4321 (la búsqueda solo funciona tras build)
pnpm build            # astro build + índice Pagefind → dist/
pnpm check            # tipos
```

## Mapa del sitio → ficheros

Todo cuelga de `src/pages/[lang]/` (`/en/…` y `/es/…`). La raíz `/` redirige según el idioma del navegador.

| Sección (Propuesta) | Rutas | Fichero |
|---|---|---|
| Home | `/` | `[lang]/index.astro` |
| About Us (historia, afiliación, instalaciones, colaboraciones, Join us) | `/about/` | `[lang]/about.astro` + `content/pages/*/about.md` |
| Research Lines + ficha | `/research-lines/`, `/research-lines/<id>/` | `[lang]/research-lines/` |
| Projects (Research / Transfer, filtro Activo/Finalizado) + ficha | `/projects/`, `/projects/research/`, `/projects/transfer/`, `/projects/<id>/` | `[lang]/projects/` |
| Publications (buscador + filtros + paginación) + ficha | `/publications/`, `/publications/<id>/` | `[lang]/publications/` |
| Resources (anexo de Publications) | `/publications/resources/` | `[lang]/publications/resources.astro` |
| Team (Head, Staff, Collaborators, I+D Students) + perfil | `/team/`, `/team/<id>/` | `[lang]/team/` |
| News, Events & Awards (unificado, filtrable) + ficha | `/news/`, `/news/<slug>/` | `[lang]/news/` |
| Contact (mailto + dirección + mapa OSM) | `/contact/` | `[lang]/contact.astro` |
| Búsqueda global | `/search/` | `[lang]/search.astro` (Pagefind) |
| Legal / privacidad | `/legal/`, `/privacy/` | `[lang]/[page].astro` |

## Modelo de contenido

Definido en [src/content.config.ts](src/content.config.ts). Las relaciones se declaran
**en un solo sentido** y el inverso se calcula en [src/lib/data.ts](src/lib/data.ts):

```
publication ──authors.person──► people ◄──pi/members── project
     │  └──projects──────────────────────────────────────┘ │
     └──lines──► lines ◄──lines── people / projects / resources
```

- **Persona → sus papers y proyectos** ("CV vivo"): no se edita nada en la persona.
- **Línea → miembros, proyectos, papers**: sale de los `lines` de cada uno.
- **Proyecto → resultados**: la ingesta vincula el paper si su financiación en OpenAlex
  coincide con `grantIds` del proyecto.

| Colección | Fuente | Quién la edita |
|---|---|---|
| `people`, `lines`, `projects`, `partners`, `resources`, `vacancies` | `src/content/<col>/*.yaml` (nombre de fichero = id) | devs |
| `news`, `pages` | `src/content/<col>/{en,es}/*.md` (mismo nombre en ambos idiomas) | devs |
| `publications` | `data/publications.json` | **ingesta** (no editar a mano) |
| stats | `data/stats.json` | **ingesta** |

### i18n
- Textos de la interfaz: [src/i18n/ui.ts](src/i18n/ui.ts). Si falta una clave en `es`, se muestra la inglesa.
- Campos traducibles en YAML: `{ en: ..., es: ... }`; `es` es opcional y si falta se usa `en`.
- Noticias: si no hay `news/es/<slug>.md`, `/es/news/<slug>/` muestra la inglesa con aviso.
- Las publicaciones se muestran en su idioma original.

## Ingesta (`ingest/`)

1. Lee los ORCID (o id de OpenAlex) de `src/content/people/*.yaml`.
2. Descarga los works de OpenAlex por autor (`config.yaml`: fecha mínima, filtro opcional por ROR UGR).
3. Normaliza → deduplica (DOI, y título+año para fusionar preprint y versión publicada).
4. Enlaza autores ↔ personas, papers ↔ proyectos (grant IDs) y ↔ líneas (heredadas del proyecto + `keywords` de la línea).
5. Aplica [`overrides.yaml`](ingest/overrides.yaml): `exclude`, `authors`, `patch`, `manual`.
6. Descarta lo que no tenga ningún autor del grupo y escribe `data/publications.json` y `data/stats.json`.

El script avisa de las publicaciones que se quedan sin línea, para revisarlas.
ORCID, Crossref, DBLP y Semantic Scholar están como stubs en `ingest/nesg_ingest/sources/complementary.py`.

## Estado / pendiente

- [x] Equipo, proyectos y datos del grupo cargados desde https://produccioncientifica.ugr.es/grupos/23838/detalle (cada YAML indica su `source` y lleva `TODO` donde falta información).
- [ ] Revisar los `TODO` de los YAML: líneas por persona y proyecto (inferidas), financiadores sin indicar, resúmenes de proyecto, traducciones de títulos.
- [ ] ORCID de Elvira Castillo, Felipe González e Irene Gosálvez (sin ORCID no se importan sus papers).
- [ ] Revisar las publicaciones sin línea que lista `pnpm ingest` y decidir si las de Derecho no relacionadas con ciberseguridad se excluyen (`overrides.yaml → exclude`).
- [ ] Noticias, recursos (datasets/código) y vacantes: no hay fuente; hay que redactarlos.
- [ ] Dominio definitivo (`site` en `astro.config.mjs`), dirección, coordenadas y GitHub (`src/config/site.ts`).
- [x] Logo UGR en `public/assets/logos/ugr.svg`.
- [ ] Resto de logos (ETSIIT, Ministerio/AEI, UE, INCIBE) → `public/assets/logos/` + `logo: /assets/logos/<fichero>.svg` en `src/content/partners/*.yaml`.
- [ ] Fotos del equipo → `src/assets/people/` + `photo: ../../assets/people/<fichero>.jpg` en el YAML (Astro las optimiza).
- [ ] Textos legales (aviso legal, privacidad).
- [ ] Despliegue: elegir entre *pull* desde el servidor (timer systemd + symlink `current/`) o GitHub Actions + rsync. Cron semanal de `pnpm ingest && pnpm build`.
- [ ] Cabeceras del servidor: CSP (permitir `frame-src https://www.openstreetmap.org` para el mapa), HSTS.
- [ ] Diseño visual definitivo (los estilos actuales son provisionales y se basan en tokens CSS).
- [ ] Gráficas interactivas (Observable Plot) si se quieren más allá del SVG por año.
- [ ] Pagefind: migrar a su *Component UI* (la Default UI funciona, pero ya no es la recomendada).
