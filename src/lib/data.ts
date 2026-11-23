/**
 * Consultas cruzadas entre colecciones: aquí vive la "automatización".
 * Las relaciones se declaran en un sentido (p. ej. publicación → autores) y
 * aquí se resuelve el sentido inverso (persona → publicaciones), así nada se
 * mantiene dos veces.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from '@/i18n/ui';
import stats from '@data/stats.json';

export type Person = CollectionEntry<'people'>;
export type Project = CollectionEntry<'projects'>;
export type Publication = CollectionEntry<'publications'>;
export type Line = CollectionEntry<'lines'>;
export type NewsItem = CollectionEntry<'news'>;

export { stats };

export const ROLE_ORDER = ['head', 'staff', 'collaborator', 'student'] as const;

const ids = (refs: { id: string }[]) => refs.map((r) => r.id);

// ---------- Colecciones ordenadas ----------

export async function getLines() {
  return (await getCollection('lines')).sort((a, b) => a.data.order - b.data.order);
}

export async function getPeople() {
  return (await getCollection('people', (p) => p.data.active)).sort(
    (a, b) =>
      ROLE_ORDER.indexOf(a.data.role) - ROLE_ORDER.indexOf(b.data.role) ||
      a.data.order - b.data.order ||
      a.data.name.localeCompare(b.data.name),
  );
}

export function projectStatus(p: Project): 'active' | 'finished' {
  if (p.data.status) return p.data.status;
  return p.data.end && p.data.end < new Date() ? 'finished' : 'active';
}

export async function getProjects() {
  return (await getCollection('projects')).sort((a, b) => +b.data.start - +a.data.start);
}

/** Fecha ordenable: la fecha completa si existe; si no, el año. */
export const pubDate = (p: Publication) => p.data.date ?? `${p.data.year}-00-00`;

/** Más recientes primero. Astro no conserva el orden del JSON, así que se ordena aquí. */
export async function getPublications() {
  const pubs = await getCollection('publications');
  return pubs.sort((a, b) => pubDate(b).localeCompare(pubDate(a)) || a.data.title.localeCompare(b.data.title));
}

/** news/en/foo.md → { lang: 'en', slug: 'foo' } */
export function newsSlug(n: NewsItem) {
  const [lang, ...rest] = n.id.split('/');
  return { lang: lang as Lang, slug: rest.join('/') };
}

/** Noticias en un idioma, con fallback a la versión inglesa si no hay traducción. */
export async function getNews(lang: Lang) {
  const all = await getCollection('news');
  const bySlug = new Map<string, NewsItem>();
  for (const n of all) {
    const { lang: nl, slug } = newsSlug(n);
    if (nl === lang || (nl === 'en' && !bySlug.has(slug))) bySlug.set(slug, n);
  }
  return [...bySlug.values()].sort((a, b) => +b.data.date - +a.data.date);
}

// ---------- Relaciones inversas ----------

export const pubsByPerson = (pubs: Publication[], personId: string) =>
  pubs.filter((p) => p.data.authors.some((a) => a.person?.id === personId));

export const pubsByLine = (pubs: Publication[], lineId: string) =>
  pubs.filter((p) => ids(p.data.lines).includes(lineId));

export const pubsByProject = (pubs: Publication[], projectId: string) =>
  pubs.filter((p) => ids(p.data.projects).includes(projectId));

export const projectsByPerson = (projects: Project[], personId: string) =>
  projects.filter((p) => [...ids(p.data.pi), ...ids(p.data.members)].includes(personId));

export const projectsByLine = (projects: Project[], lineId: string) =>
  projects.filter((p) => ids(p.data.lines).includes(lineId));

export const peopleByLine = (people: Person[], lineId: string) =>
  people.filter((p) => ids(p.data.lines).includes(lineId));

export const projectTeam = (people: Person[], project: Project) => {
  const teamIds = new Set([...ids(project.data.pi), ...ids(project.data.members)]);
  return people.filter((p) => teamIds.has(p.id));
};

// ---------- Cifras de impacto (Home) ----------

export async function getImpactFigures() {
  const [pubs, projects, people] = await Promise.all([getPublications(), getProjects(), getPeople()]);
  return {
    publications: pubs.length,
    activeProjects: projects.filter((p) => projectStatus(p) === 'active').length,
    researchers: people.filter((p) => p.data.role !== 'student').length,
  };
}

/** Recuentos por línea (tarjetas de líneas). */
export function lineCounts(lineId: string, pubs: Publication[], projects: Project[], people: Person[]) {
  return {
    pubs: pubsByLine(pubs, lineId).length,
    projects: projectsByLine(projects, lineId).length,
    people: peopleByLine(people, lineId).length,
  };
}

/** Vecinos en una lista ordenada (para las flechas anterior / siguiente de las fichas). */
export function neighbours<T extends { id: string }>(list: T[], id: string) {
  const i = list.findIndex((x) => x.id === id);
  return {
    index: i + 1,
    total: list.length,
    prev: i > 0 ? list[i - 1] : list[list.length - 1],
    next: i < list.length - 1 ? list[i + 1] : list[0],
  };
}
