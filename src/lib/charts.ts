/**
 * Cálculos para las gráficas (se ejecutan en build; el navegador solo recibe SVG).
 * Colores: las series usan los tokens --s1..--s4 de global.css, validados para
 * daltonismo y contraste en superficie clara y oscura. Orden fijo, nunca cíclico.
 */
import type { Lang } from '@/i18n/ui';
import type { Publication } from '@/lib/data';

export type TypeGroup = 'journal' | 'conference' | 'book' | 'other';

/** 8 tipos → 4 grupos (máximo de series categóricas validadas). */
export const TYPE_GROUPS: { id: TypeGroup; color: string; tag: string; tagEdge: string; label: Record<Lang, string> }[] = [
  { id: 'journal', color: 'var(--s1)', tag: 'var(--tag-1)', tagEdge: 'var(--tag-1-edge)', label: { en: 'Journal articles', es: 'Artículos de revista' } },
  { id: 'conference', color: 'var(--s2)', tag: 'var(--tag-2)', tagEdge: 'var(--tag-2-edge)', label: { en: 'Conference papers', es: 'Congresos' } },
  { id: 'book', color: 'var(--s3)', tag: 'var(--tag-3)', tagEdge: 'var(--tag-3-edge)', label: { en: 'Books & chapters', es: 'Libros y capítulos' } },
  { id: 'other', color: 'var(--s4)', tag: 'var(--tag-4)', tagEdge: 'var(--tag-4-edge)', label: { en: 'Other', es: 'Otros' } },
];

export function typeGroup(t: Publication['data']['type']): TypeGroup {
  if (t === 'journal-article') return 'journal';
  if (t === 'conference-paper') return 'conference';
  if (t === 'book' || t === 'book-chapter') return 'book';
  return 'other';
}

export type YearRow = { year: number; total: number } & Record<TypeGroup, number>;

/** Publicaciones por año y grupo de tipo, rellenando años vacíos. */
export function pubsByYear(pubs: Publication[]): YearRow[] {
  if (!pubs.length) return [];
  const years = pubs.map((p) => p.data.year);
  const min = Math.min(...years);
  const max = Math.max(...years);
  const rows: YearRow[] = [];
  for (let y = min; y <= max; y++) rows.push({ year: y, total: 0, journal: 0, conference: 0, book: 0, other: 0 });
  for (const p of pubs) {
    const r = rows[p.data.year - min];
    r[typeGroup(p.data.type)]++;
    r.total++;
  }
  return rows;
}

export function typeTotals(pubs: Publication[]) {
  const totals: Record<TypeGroup, number> = { journal: 0, conference: 0, book: 0, other: 0 };
  for (const p of pubs) totals[typeGroup(p.data.type)]++;
  return totals;
}

/** Ticks "bonitos" para un eje 0..max (3-4 líneas de rejilla). */
export function niceTicks(max: number, count = 3): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/** Rectángulo con solo las esquinas superiores redondeadas (extremo de dato). */
export function roundedTop(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/** Rectángulo con solo las esquinas derechas redondeadas (barras horizontales). */
export function roundedRight(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.min(r, h / 2, w);
  return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
}

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Fragmento HTML para tooltips: punto de color + etiqueta + valor. */
export const tipRow = (color: string, label: string, value: string | number) =>
  `<i style="background:${color}"></i>${esc(label)}: <b>${value}</b>`;
