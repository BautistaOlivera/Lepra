import type { Plugin } from 'vite'

/** Post-build: quita modulepreload (warnings de credentials en Chrome). */
export function cleanHtmlAssets(): Plugin {
  return {
    name: 'lepra-clean-html-assets',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        let out = html.replace(/\s*<link rel="modulepreload"[^>]*>\n?/g, '\n')
        out = out.replace(
          /<link rel="stylesheet"(?![^>]*\bcrossorigin\b)([^>]*href="\/assets\/[^"]+"[^>]*)>/g,
          '<link rel="stylesheet" crossorigin$1>',
        )
        out = out.replace(
          /<script type="module"(?![^>]*\bcrossorigin\b)([^>]*src="\/assets\/[^"]+"[^>]*)><\/script>/g,
          '<script type="module" crossorigin$1></script>',
        )
        return out
      },
    },
  }
}
