/**
 * Modelo de contenido NESG.
 *
 * Dos tipos de fuente:
 *  - Editorial (lo mantienen los devs en el repo): people, lines, projects,
 *    resources, partners, vacancies, news, pages.
 *  - Generada (la escribe la ingesta en /data, NO editar a mano): publications, stats.
 *
 * Imágenes: logos (partners, proyectos) = rutas de /public (p. ej. /assets/logos/ugr.svg),
 * se sirven tal cual. Fotos del equipo = image() relativas a src/assets/, para que
 * Astro las redimensione y convierta a WebP.
 *
 * Las relaciones se declaran en un solo sentido con `reference()` y el sentido
 * inverso se calcula en build (src/lib/data.ts). Así una publicación nueva
 * aparece sola en la ficha de sus autores, proyectos y líneas.
 *
 * i18n: los campos traducibles son objetos { en, es }. `es` es opcional y si
 * falta se muestra el inglés (ver localize() en src/i18n/utils.ts).
 */
import { defineCollection, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

const i18n = z.object({ en: z.string(), es: z.string().optional() });

const lines = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/lines' }),
  schema: z.object({
    order: z.number(),
    title: i18n,
    short: i18n,
    description: i18n, // markdown
    icon: z.string().optional(),
    // Palabras clave para que la ingesta clasifique papers automáticamente
    // (se comparan con topics/keywords de OpenAlex). Ver ingest/README.md.
    keywords: z.array(z.string()).default([]),
  }),
});

const people = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/people' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      role: z.enum(['head', 'staff', 'collaborator', 'student']),
      position: i18n.optional(), // "Full Professor", "PhD Student"...
      photo: image().optional(),
      orcid: z.string().regex(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/).optional(),
      openalex: z.string().optional(), // A123456789, si ORCID no basta
      email: z.email().optional(),
      lines: z.array(reference('lines')).default([]),
      bio: i18n.optional(),
      links: z
        .object({
          web: z.url().optional(),
          scholar: z.url().optional(),
          dblp: z.url().optional(),
          github: z.url().optional(),
          linkedin: z.url().optional(),
        })
        .default({}),
      active: z.boolean().default(true),
      order: z.number().default(100),
    }),
});

const projects = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/projects' }),
  schema:
    z.object({
      title: i18n,
      acronym: z.string().optional(),
      type: z.enum(['research', 'transfer']),
      code: z.string().optional(), // Project ID / referencia de la convocatoria
      funder: z.string().optional(),
      call: z.string().optional(),
      start: z.coerce.date(),
      end: z.coerce.date().optional(),
      // Si no se indica, se deriva de `end` en build.
      status: z.enum(['active', 'finished']).optional(),
      lines: z.array(reference('lines')).default([]),
      pi: z.array(reference('people')).default([]),
      members: z.array(reference('people')).default([]),
      partners: z.array(reference('partners')).default([]),
      logo: z.string().startsWith('/').optional(), // ruta en /public
      url: z.url().optional(),
      featured: z.boolean().default(false),
      summary: i18n.optional(),
      description: i18n.optional(), // markdown
      source: z.url().optional(), // ficha oficial (produccioncientifica.ugr.es)
      // IDs de ayuda tal como aparecen en OpenAlex (grants.award_id); la
      // ingesta los usa para vincular papers con el proyecto.
      grantIds: z.array(z.string()).default([]),
    }),
});

const partners = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/partners' }),
  schema:
    z.object({
      name: z.string(),
      kind: z.enum(['institution', 'funder', 'network', 'research-institute', 'company']),
      logo: z.string().startsWith('/').optional(), // ruta en /public, p. ej. /assets/logos/ugr.svg
      url: z.url().optional(),
      trust: z.boolean().default(false), // aparece en la franja de logos de la Home
      collaboration: i18n.optional(), // texto para "Colaboraciones y redes"
      order: z.number().default(100),
    }),
});

const resources = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/resources' }),
  schema: z.object({
    title: z.string(),
    kind: z.enum(['dataset', 'code', 'tool']),
    url: z.url(),
    description: i18n,
    license: z.string().optional(),
    lines: z.array(reference('lines')).default([]),
    publications: z.array(reference('publications')).default([]),
  }),
});

const vacancies = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/vacancies' }),
  schema: z.object({
    title: i18n,
    kind: z.enum(['phd', 'postdoc', 'grant', 'tfg', 'tfm', 'other']),
    open: z.boolean().default(true),
    deadline: z.coerce.date().optional(),
    url: z.url().optional(),
    contact: reference('people').optional(),
    description: i18n,
  }),
});

// News, Events y Awards en un solo repositorio filtrable (Propuesta §3).
// Un .md por idioma: news/en/<slug>.md y news/es/<slug>.md (mismo slug).
const news = defineCollection({
  loader: glob({ pattern: '{en,es}/*.md', base: './src/content/news' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      kind: z.enum(['news', 'event', 'award']),
      date: z.coerce.date(),
      summary: z.string(),
      image: image().optional(),
      eventDate: z.coerce.date().optional(),
      location: z.string().optional(),
      people: z.array(reference('people')).default([]),
      projects: z.array(reference('projects')).default([]),
    }),
});

// Textos largos de páginas institucionales (About, legal...).
// About: el cuerpo es "Historia y misión"; `facilities` va aparte para maquetarlo en su sección.
const pages = defineCollection({
  loader: glob({ pattern: '{en,es}/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    lead: z.string().optional(),
    facilities: z.string().optional(), // markdown
  }),
});

// ---- Generadas por la ingesta (ingest/) ----

const author = z.object({
  name: z.string(),
  orcid: z.string().nullable().default(null),
  person: reference('people').nullable().default(null), // miembro del grupo
});

const publications = defineCollection({
  loader: file('data/publications.json'),
  schema: z.object({
    title: z.string(),
    year: z.number(),
    date: z.string().nullable().default(null),
    type: z.enum([
      'journal-article',
      'conference-paper',
      'book-chapter',
      'book',
      'preprint',
      'thesis',
      'dataset',
      'other',
    ]),
    venue: z.string().nullable().default(null),
    publisher: z.string().nullable().default(null),
    abstract: z.string().nullable().default(null),
    authors: z.array(author),
    doi: z.string().nullable().default(null),
    openalex: z.string().nullable().default(null),
    lines: z.array(reference('lines')).default([]),
    projects: z.array(reference('projects')).default([]),
    links: z
      .object({
        doi: z.url().optional(),
        pdf: z.url().optional(),
        oa: z.url().optional(),
        code: z.url().optional(),
        dataset: z.url().optional(),
      })
      .default({}),
    citations: z.number().default(0),
    openAccess: z.boolean().default(false),
  }),
});

export const collections = {
  lines,
  people,
  projects,
  partners,
  resources,
  vacancies,
  news,
  pages,
  publications,
};
