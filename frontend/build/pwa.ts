import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

export function pwaAssets(): Plugin {
  const readPublic = (path: string) =>
    readFileSync(fileURLToPath(new URL(`../public${path}`, import.meta.url)))
  const fingerprint = (content: string | Uint8Array) =>
    createHash('sha256').update(content).digest('hex').slice(0, 12)
  const versionedFiles = new Map<string, Buffer>()
  function versionIcon(path: string) {
    if (!/^\/icons\/[^/]+\.(png|svg)$/.test(path) || path.includes('..'))
      throw new Error('O ícone do PWA deve ser um arquivo local em /icons/.')
    const source = readPublic(path)
    const dot = path.lastIndexOf('.')
    const output = `${path.slice(0, dot)}-${fingerprint(source)}${path.slice(dot)}`
    versionedFiles.set(output, source)
    return output
  }
  const manifest = JSON.parse(readPublic('/manifest.webmanifest').toString('utf8')) as {
    icons: Array<{ src: string; [key: string]: unknown }>
    [key: string]: unknown
  }
  manifest.icons = manifest.icons.map((icon) => ({ ...icon, src: versionIcon(icon.src) }))
  const manifestSource = JSON.stringify(manifest, null, 2) + '\n'
  const manifestPath = `/manifest-${fingerprint(manifestSource)}.webmanifest`
  const appleIcon = versionIcon('/icons/apple-touch-icon.png')
  const favicon = versionIcon('/icons/favicon-32.png')
  return {
    name: 'carcicontrol-pwa',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html
          .replaceAll('href="/manifest.webmanifest"', `href="${manifestPath}"`)
          .replaceAll('href="/icons/apple-touch-icon.png"', `href="${appleIcon}"`)
          .replaceAll('href="/icons/favicon-32.png"', `href="${favicon}"`)
      },
    },
    generateBundle(_options, bundle) {
      for (const [path, source] of versionedFiles)
        this.emitFile({ type: 'asset', fileName: path.slice(1), source })
      this.emitFile({ type: 'asset', fileName: manifestPath.slice(1), source: manifestSource })
      const publicFiles = ['/offline.html', manifestPath, ...versionedFiles.keys()]
      const assets = Object.keys(bundle)
        .filter((file) => /\.(js|css|woff2|png|svg)$/.test(file))
        .map((file) => `/${file}`)
      const hash = createHash('sha256')
      for (const file of Object.values(bundle))
        hash.update(file.type === 'chunk' ? file.code : file.source)
      hash.update(manifestSource).update(readPublic('/offline.html'))
      for (const source of versionedFiles.values()) hash.update(source)
      const cache = `carcicontrol-static-${hash.digest('hex').slice(0, 16)}`
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `
const CACHE = ${JSON.stringify(cache)};
const ASSETS = ${JSON.stringify([...new Set([...publicFiles, ...assets])])};
const PUBLIC_PATHS = new Set(ASSETS);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('carcicontrol-static-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.open(CACHE)).match('/offline.html')));
    return;
  }
  if (PUBLIC_PATHS.has(url.pathname)) {
    event.respondWith((async () => (await (await caches.open(CACHE)).match(request, { ignoreSearch: true })) || fetch(request))());
  }
});
`,
      })
    },
  }
}
