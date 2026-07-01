import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import BookStage from '../components/BookStage.jsx'
import ShareSeal from '../components/ShareSeal.jsx'
import ProgressRibbon from '../components/ProgressRibbon.jsx'
import { renderPdfToPageImages } from '../lib/pdfToImages.js'
import { playPageTurnSound, primeAudio } from '../lib/sound.js'
import { supabase, isSupabaseConfigured, BOOKS_TABLE, PDF_BUCKET } from '../lib/supabaseClient.js'

function useViewportSize() {
  const [size, setSize] = useState({
    width: typeof window === 'undefined' ? 800 : window.innerWidth,
    height: typeof window === 'undefined' ? 800 : window.innerHeight,
  })

  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return size
}

export default function Book() {
  const { id } = useParams()
  const [phase, setPhase] = useState('loading-record') // loading-record | rendering | ready | not-found | error
  const [errorMessage, setErrorMessage] = useState('')
  const [book, setBook] = useState(null)
  const [pages, setPages] = useState([])
  const [aspectRatio, setAspectRatio] = useState(0.72)
  const [renderProgress, setRenderProgress] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [soundOn, setSoundOn] = useState(true)
  const flipBookRef = useRef(null)
  const viewport = useViewportSize()

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!isSupabaseConfigured) {
        setPhase('error')
        setErrorMessage(
          'Storage isn\u2019t configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY \u2014 see README.md.'
        )
        return
      }

      setPhase('loading-record')

      const { data: record, error: fetchError } = await supabase
        .from(BOOKS_TABLE)
        .select('id, title, file_path, page_count')
        .eq('id', id)
        .maybeSingle()

      if (cancelled) return

      if (fetchError) {
        setPhase('error')
        setErrorMessage(fetchError.message)
        return
      }

      if (!record) {
        setPhase('not-found')
        return
      }

      setBook(record)
      setPhase('rendering')

      const { data: publicUrlData } = supabase.storage.from(PDF_BUCKET).getPublicUrl(record.file_path)

      try {
        const { pages: renderedPages, width, height } = await renderPdfToPageImages(
          publicUrlData.publicUrl,
          ({ loaded, total }) => {
            if (!cancelled) setRenderProgress(total > 0 ? loaded / total : 0)
          }
        )

        if (cancelled) return

        setPages(renderedPages)
        setAspectRatio(width && height ? width / height : 0.72)
        setPhase('ready')

        if (!record.page_count) {
          await supabase
            .from(BOOKS_TABLE)
            .update({ page_count: renderedPages.length })
            .eq('id', id)
        }
      } catch (err) {
        if (!cancelled) {
          setPhase('error')
          setErrorMessage(
            err?.message || 'This PDF could not be opened. It may be corrupted or password-protected.'
          )
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  const stageSize = useMemo(() => {
    const isMobile = viewport.width < 640
    const maxHeight = Math.min(viewport.height * (isMobile ? 0.62 : 0.72), 760)
    const maxWidth = Math.min(viewport.width * (isMobile ? 0.86 : 0.42), 620)
    return { width: maxWidth, height: maxHeight }
  }, [viewport])

  const handleFlip = useCallback(
    (event) => {
      setCurrentPage(event.data)
      if (soundOn) playPageTurnSound(0.3)
    },
    [soundOn]
  )

  const goNext = () => {
    primeAudio()
    flipBookRef.current?.pageFlip()?.flipNext()
  }

  const goPrev = () => {
    primeAudio()
    flipBookRef.current?.pageFlip()?.flipPrev()
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (phase !== 'ready') return
      if (event.key === 'ArrowRight') goNext()
      if (event.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [phase])

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

  if (phase === 'not-found') {
    return (
      <StatusScreen
        title="This book doesn’t exist"
        detail="The link may be mistyped, or the book may have been removed."
      />
    )
  }

  if (phase === 'error') {
    return <StatusScreen title="This page won’t turn" detail={errorMessage} />
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-ink px-4 py-8 sm:px-8">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-wine/20 blur-[160px]" />

      <header className="relative z-10 flex w-full max-w-3xl items-center justify-between">
        <Link
          to="/"
          className="font-display text-lg italic text-parchment/80 transition-colors hover:text-gold-bright"
        >
          ← Keepsake
        </Link>
        {book && (
          <h1 className="hidden max-w-xs truncate font-display text-lg italic text-parchment/90 sm:block">
            {book.title}
          </h1>
        )}
        <button
          type="button"
          onClick={() => setSoundOn((prev) => !prev)}
          aria-pressed={soundOn}
          aria-label={soundOn ? 'Mute page-turn sound' : 'Unmute page-turn sound'}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-mist transition-colors hover:border-gold/50 hover:text-gold-bright"
        >
          {soundOn ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
              <path d="M17 8a5 5 0 0 1 0 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
              <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center py-8">
        {(phase === 'loading-record' || phase === 'rendering') && (
          <div className="flex flex-col items-center gap-6">
            <div className="h-16 w-12 animate-pulse rounded-sm bg-gradient-to-br from-wine to-ink-deep shadow-book" />
            <ProgressRibbon
              label={phase === 'loading-record' ? 'Opening your book' : 'Turning pages into paper'}
              progress={phase === 'loading-record' ? 0.15 : renderProgress}
            />
          </div>
        )}

        {phase === 'ready' && pages.length > 0 && (
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-3 sm:gap-6">
              <NavArrow direction="prev" onClick={goPrev} disabled={currentPage === 0} />
              <BookStage
                ref={flipBookRef}
                pages={pages}
                aspectRatio={aspectRatio}
                onFlip={handleFlip}
                size={stageSize}
              />
              <NavArrow direction="next" onClick={goNext} disabled={currentPage >= pages.length - 1} />
            </div>
            <p className="text-xs uppercase tracking-[0.25em] text-mist">
              Page {Math.min(currentPage + 1, pages.length)} of {pages.length}
            </p>
          </div>
        )}
      </div>

      {phase === 'ready' && (
        <footer className="relative z-10">
          <ShareSeal url={shareUrl} />
        </footer>
      )}
    </main>
  )
}

function NavArrow({ direction, onClick, disabled }) {
  const isPrev = direction === 'prev'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isPrev ? 'Previous page' : 'Next page'}
      className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-parchment/70 transition-all duration-200 hover:border-gold/50 hover:text-gold-bright disabled:pointer-events-none disabled:opacity-0 sm:flex"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d={isPrev ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

function StatusScreen({ title, detail }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink px-6 text-center">
      <p className="font-display text-3xl italic text-parchment">{title}</p>
      <p className="max-w-sm text-sm text-mist">{detail}</p>
      <Link
        to="/"
        className="mt-4 rounded-full border border-gold/40 px-5 py-2 text-xs uppercase tracking-[0.2em] text-gold-bright transition-colors hover:border-gold-bright hover:bg-gold/10"
      >
        Start a new book
      </Link>
    </main>
  )
}
