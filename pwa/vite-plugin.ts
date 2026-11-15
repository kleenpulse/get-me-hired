// Makes the built app installable and usable offline (FR-1.3), with no
// dependency: it writes /manifest.webmanifest, copies the icons, and writes
// /sw.js from pwa/service-worker.js with the list of built files, a version
// made from that list, and the request routing from app/sw-route.ts.
//
// Only for `vite build`: the dev server never gets a service worker.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { swRoute } from '../app/sw-route';
import { strings } from '../app/strings';

/** The icons, rendered once from assets/favicon.svg (see CLAUDE.md, "App icons"). */
const ICONS = [
  { file: 'icon-192.png', size: 192, purpose: 'any' },
  { file: 'icon-512.png', size: 512, purpose: 'any' },
  { file: 'icon-maskable-512.png', size: 512, purpose: 'maskable' },
  { file: 'apple-touch-icon.png', size: 180, purpose: null },
] as const;

const read = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url));

export function pwa(): Plugin {
  return {
    name: 'get-me-hired-pwa',
    apply: 'build',
    // After Vite has written index.html into the bundle, so it's on the list.
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const icon of ICONS) this.emitFile({ type: 'asset', fileName: `icons/${icon.file}`, source: read(`icons/${icon.file}`) });

      const manifest = {
        id: '/',
        name: strings.pwa.name,
        short_name: strings.pwa.shortName,
        description: strings.pwa.description,
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: ICONS.filter((icon) => icon.purpose).map((icon) => ({
          src: `/icons/${icon.file}`,
          sizes: `${icon.size}x${icon.size}`,
          type: 'image/png',
          purpose: icon.purpose,
        })),
      };
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: `${JSON.stringify(manifest, null, 2)}\n` });

      // Everything built, so every screen opens offline. Source maps and the worker itself stay out.
      const files = [...Object.keys(bundle), ...ICONS.map((icon) => `icons/${icon.file}`), 'manifest.webmanifest']
        .filter((file) => !file.endsWith('.map') && file !== 'sw.js')
        .sort();
      const precache = files.map((file) => `/${file}`);
      const version = createHash('sha256').update(precache.join('\n')).digest('hex').slice(0, 12);
      const worker = read('service-worker.js')
        .toString('utf8')
        .replace('__VERSION__', JSON.stringify(version))
        .replace('__PRECACHE__', JSON.stringify(precache))
        .replace('__ROUTE__', swRoute.toString());
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: worker });
    },
  };
}
