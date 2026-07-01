import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const RENDER_SCALE = 1.6
const MAX_RENDER_SCALE_DIMENSION = 2200

/**
 * Loads a PDF (from a URL or an ArrayBuffer) and rasterizes every page to a
 * PNG data URL. Returns the images plus the average page aspect ratio, which
 * the flipbook uses to size itself correctly.
 *
 * @param {string | ArrayBuffer} source
 * @param {(progress: { loaded: number, total: number, stage: string }) => void} [onProgress]
 * @returns {Promise<{ pages: string[], width: number, height: number }>}
 */
export async function renderPdfToPageImages(source, onProgress) {
  const loadingTask = pdfjsLib.getDocument(
    typeof source === 'string' ? { url: source } : { data: source }
  )

  loadingTask.onProgress = ({ loaded, total }) => {
    if (onProgress) onProgress({ loaded, total: total || loaded, stage: 'downloading' })
  }

  const pdf = await loadingTask.promise
  const pageCount = pdf.numPages
  const pages = []
  let width = 0
  let height = 0

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    // eslint-disable-next-line no-await-in-loop
    const page = await pdf.getPage(pageNumber)
    const baseViewport = page.getViewport({ scale: 1 })

    // Keep very large pages from producing multi-thousand-pixel canvases.
    const largestSide = Math.max(baseViewport.width, baseViewport.height)
    const scale = Math.min(RENDER_SCALE, MAX_RENDER_SCALE_DIMENSION / largestSide)
    const viewport = page.getViewport({ scale: Math.max(scale, 0.5) })

    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d', { alpha: false })

    // eslint-disable-next-line no-await-in-loop
    await page.render({ canvasContext: context, viewport }).promise

    pages.push(canvas.toDataURL('image/jpeg', 0.9))

    if (pageNumber === 1) {
      width = viewport.width
      height = viewport.height
    }

    if (onProgress) {
      onProgress({ loaded: pageNumber, total: pageCount, stage: 'rendering' })
    }

    canvas.width = 0
    canvas.height = 0
  }

  return { pages, width, height }
}
