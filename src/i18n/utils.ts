import { marked } from 'marked';
import { languages, ui, type Lang, type UIKey } from './ui';
export { languages };

export const langs = Object.keys(languages) as Lang[];

/** getStaticPaths base para todas las páginas bajo src/pages/[lang]/ */
export const langPaths = () => langs.map((lang) => ({ params: { lang } }));

export function useTranslations(lang: Lang) {
  return (key: UIKey): string => (ui[lang] as Record<string, string>)[key] ?? ui.en[key];
}

/** Campo traducible { en, es? } → texto en el idioma pedido (fallback a inglés). */
export function localize(field: { en: string; es?: string } | undefined, lang: Lang): string {
  if (!field) return '';
  return field[lang] ?? field.en;
}

export function md(text: string | undefined): string {
  return text ? (marked.parse(text, { async: false }) as string) : '';
}

/** Ruta interna localizada: l('es', '/team/') → '/es/team/' */
export function l(lang: Lang, path = '/'): string {
  const i = path.search(/[#?]/);
  const [p, suffix] = i === -1 ? [path, ''] : [path.slice(0, i), path.slice(i)];
  return `/${lang}/${p}/`.replace(/\/+/g, '/') + suffix;
}

/** Misma página en otro idioma (para el selector y hreflang). */
export function switchLang(pathname: string, to: Lang): string {
  const parts = pathname.split('/');
  if (langs.includes(parts[1] as Lang)) parts[1] = to;
  else parts.splice(1, 0, to);
  return parts.join('/');
}

export function formatDate(d: Date | string, lang: Lang, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) {
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-GB', opts).format(new Date(d));
}
