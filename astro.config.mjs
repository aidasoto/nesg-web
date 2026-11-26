// @ts-check
import { defineConfig } from 'astro/config';

// Variables de entorno del build (sin depender de @types/node)
const env = /** @type {any} */ (globalThis).process.env;

export default defineConfig({
  // TODO: dominio definitivo del cliente (necesario para canonical, sitemap y hreflang)
  // En GitHub Pages (workflow .github/workflows/deploy.yml) se sobrescriben con SITE y BASE_PATH,
  // p. ej. SITE=https://<usuario>.github.io BASE_PATH=/nesg-web. En local/servidor propio: raíz.
  site: env.SITE || 'https://nesg.ugr.es',
  base: env.BASE_PATH || '/',
  output: 'static',
  trailingSlash: 'always',
  i18n: {
    locales: ['en', 'es'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false, // la raíz la gestiona src/pages/index.astro
    },
  },
});
