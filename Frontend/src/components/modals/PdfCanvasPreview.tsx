import { useEffect, useRef, useState } from 'react'

type PdfViewport = { width: number; height: number }

type PdfPage = {
  getViewport: (params: { scale: number }) => PdfViewport
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => { promise: Promise<void> }
}

type PdfDoc = {
  numPages: number
  getPage: (n: number) => Promise<PdfPage>
  destroy: () => Promise<void>
}

type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string }
  getDocument: (src: {
    data: Uint8Array
    standardFontDataUrl: string
    useSystemFonts: boolean
  }) => { promise: Promise<PdfDoc>; destroy: () => void }
}

async function loadPdfJs(): Promise<PdfJs> {
  const [mod, workerMod] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.js'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.js?url'),
  ])
  const pdfjs = ((mod as { default?: PdfJs }).default ?? mod) as PdfJs
  const workerUrl = (workerMod as { default?: string }).default ?? (workerMod as unknown as string)
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  return pdfjs
}

/**
 * Chrome en Android no dibuja un PDF dentro de un iframe: muestra «Abrir» y el id del blob.
 * Esta vista pinta las páginas en canvas, sin visor del navegador.
 */
export function PdfCanvasPreview({
  data,
  onReady,
  onError,
}: {
  data: Uint8Array
  onReady: () => void
  onError: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const onReadyRef = useRef(onReady)
  const onErrorRef = useRef(onError)
  onReadyRef.current = onReady
  onErrorRef.current = onError

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let task: { promise: Promise<PdfDoc>; destroy: () => void } | null = null
    let doc: PdfDoc | null = null

    ;(async () => {
      const pdfjs = await loadPdfJs()
      if (cancelled) return
      const base = import.meta.env.BASE_URL || '/'
      const fontBase = `${base.endsWith('/') ? base : `${base}/`}pdfjs/standard_fonts/`
      task = pdfjs.getDocument({
        data: data.slice(),
        standardFontDataUrl: fontBase,
        useSystemFonts: true,
      })
      const pdf = await task.promise
      doc = pdf
      if (cancelled) return
      host.replaceChildren()
      const targetWidth = Math.max(280, Math.min(host.clientWidth || window.innerWidth - 24, 900))
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        if (cancelled) return
        const baseViewport = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: targetWidth / baseViewport.width })
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        canvas.width = Math.floor(viewport.width * ratio)
        canvas.height = Math.floor(viewport.height * ratio)
        canvas.style.width = '100%'
        canvas.style.height = 'auto'
        canvas.style.display = 'block'
        canvas.style.background = '#fff'
        canvas.style.marginBottom = i === pdf.numPages ? '0' : '8px'
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        host.appendChild(canvas)
        await page.render({ canvasContext: ctx, viewport }).promise
      }
      if (!cancelled) onReadyRef.current()
    })().catch((e) => {
      console.error(e)
      if (cancelled) return
      setFailed(true)
      onErrorRef.current()
    })

    return () => {
      cancelled = true
      if (doc) void doc.destroy()
      else task?.destroy()
    }
  }, [data])

  if (failed) {
    return <div className="text-center text-muted py-5 flex-grow-1">No se pudo mostrar el PDF.</div>
  }
  return <div ref={hostRef} className="w-100 bg-white" />
}
