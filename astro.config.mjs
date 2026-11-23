// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // TODO: dominio definitivo del cliente (necesario para canonical, sitemap y hreflang)
  site: 'https://nesg.ugr.es',
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
