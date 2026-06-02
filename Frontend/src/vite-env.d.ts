/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_PDF_LOGO_URL?: string
  readonly VITE_DEV_HTTPS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
