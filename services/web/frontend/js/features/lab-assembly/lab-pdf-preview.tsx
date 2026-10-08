import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

export default function LabPdfPreview({ url }: { url: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    let task: { destroy: () => Promise<void> } | undefined
    setLoading(true)
    setError('')
    setDocument(null)
    setPage(1)
    const load = async () => {
      try {
        const { loadPdfDocumentFromUrl } =
          await import('../pdf-preview/util/pdf-js')
        if (!active) return
        const loadingTask = loadPdfDocumentFromUrl(url)
        task = loadingTask
        const pdf = await loadingTask.promise
        if (active) setDocument(pdf)
      } catch {
        if (active) {
          setLoading(false)
          setError('PDF를 표시하지 못했습니다. PDF 다운로드를 이용해 주세요.')
        }
      }
    }
    load()
    return () => {
      active = false
      void task?.destroy()
    }
  }, [url])

  useEffect(() => {
    if (!document || !canvas.current || !container.current) return
    let active = true
    let task: RenderTask | undefined
    setLoading(true)
    setError('')
    const render = async () => {
      try {
        const pdfPage = await document.getPage(page)
        if (!active || !canvas.current || !container.current) return
        const width = pdfPage.getViewport({ scale: 1 }).width
        const scale = Math.min(
          1.5,
          (container.current.clientWidth - 32) / width
        )
        const viewport = pdfPage.getViewport({ scale })
        const ratio = window.devicePixelRatio || 1
        canvas.current.width = Math.ceil(viewport.width * ratio)
        canvas.current.height = Math.ceil(viewport.height * ratio)
        canvas.current.style.width = `${viewport.width}px`
        canvas.current.style.height = 'auto'
        task = pdfPage.render({
          canvasContext: canvas.current.getContext('2d')!,
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0]
        })
        await task.promise
        if (active) setLoading(false)
      } catch {
        if (active) {
          setLoading(false)
          setError(
            '이 페이지를 표시하지 못했습니다. PDF 다운로드를 이용해 주세요.'
          )
        }
      }
    }
    render()
    return () => {
      active = false
      task?.cancel()
    }
  }, [document, page])

  return (
    <div>
      <div className="lab-pdf-page-controls">
        <button
          className="btn btn-sm btn-secondary"
          disabled={loading || page <= 1}
          onClick={() => setPage(p => p - 1)}
        >
          이전 페이지
        </button>
        <span>
          {page} / {document?.numPages || '…'} 페이지
        </span>
        <button
          className="btn btn-sm btn-secondary"
          disabled={loading || !document || page >= document.numPages}
          onClick={() => setPage(p => p + 1)}
        >
          다음 페이지
        </button>
      </div>
      {loading && <p role="status">PDF를 표시하는 중…</p>}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <div className="lab-pdf-canvas-wrap" ref={container}>
        <canvas ref={canvas} role="img" aria-label={`PDF ${page}페이지`} />
      </div>
    </div>
  )
}
