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

declare module 'pdfjs-dist/legacy/build/pdf.js' {
  const pdfjs: {
    GlobalWorkerOptions: { workerSrc: string }
    getDocument: (src: {
      data: Uint8Array
      standardFontDataUrl: string
      useSystemFonts: boolean
    }) => { promise: Promise<unknown>; destroy: () => void }
  }
  export default pdfjs
}

declare module 'pdfjs-dist/legacy/build/pdf.worker.min.js?url' {
  const url: string
  export default url
}
