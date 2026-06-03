import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

const SW_MIGRATION_KEY = 'lepra-pwa-v3'
const SW_MIGRATION_SNIPPET = `<script>
(function () {
  try {
    if (localStorage.getItem('${SW_MIGRATION_KEY}') === '1') return;
  } catch (e) { return; }
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.getRegistrations().then(function (regs) {
    var needsLegacyCleanup = regs.some(function (reg) {
      var url = ((reg.active || reg.installing || reg.waiting) || {}).scriptURL || '';
      return url && !url.includes('/sw-v2.js');
    });
    if (!needsLegacyCleanup) {
      try { localStorage.setItem('${SW_MIGRATION_KEY}', '1'); } catch (e) {}
      return;
    }
    return Promise.all(regs.map(function (r) { return r.unregister(); }))
      .then(function () { return caches.keys(); })
      .then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      })
      .then(function () {
        try { localStorage.setItem('${SW_MIGRATION_KEY}', '1'); } catch (e) {}
        location.reload();
      });
  });
})();
</script>`

function cleanIndexHtml(html: string): string {
  let out = html.replace(/\s*<link rel="modulepreload"[^>]*>\n?/gi, '\n')
  out = out.replace(/\s*<link rel="preload"[^>]*href="\/assets\/[^"]*"[^>]*>\n?/gi, '\n')
  out = out.replace(
    /<link rel="stylesheet"(?![^>]*\bcrossorigin\b)([^>]*href="\/assets\/[^"]+"[^>]*)>/g,
    '<link rel="stylesheet" crossorigin$1>',
  )
  out = out.replace(
    /<script type="module"(?![^>]*\bcrossorigin\b)([^>]*src="\/assets\/[^"]+"[^>]*)><\/script>/g,
    '<script type="module" crossorigin$1></script>',
  )
  if (!out.includes(SW_MIGRATION_KEY)) {
    out = out.replace('</head>', `${SW_MIGRATION_SNIPPET}\n</head>`)
  }
  return out
}

/** Post-build: quita preloads y migra SW legacy (warnings + precache 404). */
export function cleanHtmlAssets(): Plugin {
  return {
    name: 'lepra-clean-html-assets',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return cleanIndexHtml(html)
      },
    },
    closeBundle() {
      const indexPath = path.resolve(process.cwd(), 'dist', 'index.html')
      if (!fs.existsSync(indexPath)) return
      const html = fs.readFileSync(indexPath, 'utf8')
      const cleaned = cleanIndexHtml(html)
      if (cleaned !== html) {
        fs.writeFileSync(indexPath, cleaned, 'utf8')
      }
    },
  }
}
