import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import BookStage from '../components/BookStage.jsx'
import ShareSeal from '../components/ShareSeal.jsx'
import ProgressRibbon from '../components/ProgressRibbon.jsx'
import { renderPdfToPageImages } from '../lib/pdfToImages.js'
import { playPageTurnSound, primeAudio } from '../lib/sound.js'
import { useBackgroundPlaylist } from '../lib/useBackgroundPlaylist.js'
import { supabase, isSupabaseConfigured, BOOKS_TABLE, PDF_BUCKET } from '../lib/supabaseClient.js'

// Add up to a few tracks here — see public/music/README.md for where to
// put the actual files. They play in this order, then loop back to the
// start, only while this book page is open.
const BACKGROUND_TRACKS = ['/music/track-1.mp3', '/music/track-2.mp3', '/music/track-3.mp3']
const BACKGROUND_VOLUME = 0.14

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
  const { enabled: musicOn, arm: armMusic, toggle: toggleMusic } = useBackgroundPlaylist(
    BACKGROUND_TRACKS,
    BACKGROUND_VOLUME
  )

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
    // A book whose pages are wider than they are tall (slides exported to
    // PDF, most decks) needs a box that's allowed to go wide — the old
    // fixed 42%-of-viewport cap was tuned for portrait pages only, which is
    // what made landscape pages look squeezed. BookStage still fits the
    // exact aspect ratio inside whichever box we hand it here.
    const isLandscape = aspectRatio > 1.05
    const maxHeight = isLandscape
      ? Math.min(viewport.height * (isMobile ? 0.5 : 0.62), 620)
      : Math.min(viewport.height * (isMobile ? 0.62 : 0.72), 760)
    const maxWidth = isLandscape
      ? Math.min(viewport.width * (isMobile ? 0.92 : 0.8), 980)
      : Math.min(viewport.width * (isMobile ? 0.86 : 0.42), 620)
    return { width: maxWidth, height: maxHeight }
  }, [viewport, aspectRatio])

  const handleFlip = useCallback(
    (event) => {
      setCurrentPage(event.data)
      if (soundOn) playPageTurnSound(0.3)
      armMusic()
    },
    [soundOn, armMusic]
  )

  const goNext = useCallback(() => {
    primeAudio()
    armMusic()
    flipBookRef.current?.pageFlip()?.flipNext()
  }, [armMusic])

  const goPrev = useCallback(() => {
    primeAudio()
    armMusic()
    flipBookRef.current?.pageFlip()?.flipPrev()
  }, [armMusic])

  // On mobile there are no visible nav-arrow buttons to tap (navigation is
  // by swipe), and the flip library's own touch handling runs before our
  // events would normally bubble up to us — by the time our onFlip
  // callback fires the flip animation has already finished, which is too
  // late for a mobile browser to still consider it "triggered by the
  // user" and allow audio.play() to succeed. Using the *capture* phase on
  // this wrapper means our handler runs the instant the finger touches
  // down, before the library gets a chance to swallow the event, so audio
  // reliably unlocks on the very first swipe.
  const handleBookInteraction = useCallback(() => {
    primeAudio()
    armMusic()
  }, [armMusic])

  useEffect(() => {
    function handleKeyDown(event) {
      if (phase !== 'ready') return
      if (event.key === 'ArrowRight') goNext()
      if (event.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [phase, goNext, goPrev])

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

      <header className="relative z-10 flex w-full max-w-3xl items-center justify-between rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 shadow-lg shadow-black/20 backdrop-blur-md">
        <Link
          to="/"
          className="rounded-full px-2 py-1 font-display text-lg italic text-parchment/80 transition-colors duration-300 hover:text-gold-bright"
        >
          ← Keepsake
        </Link>
        {book && (
          <h1 className="hidden max-w-xs truncate font-display text-lg italic text-parchment/90 sm:block">
            {book.title}
          </h1>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMusic}
            aria-pressed={musicOn}
            aria-label={musicOn ? 'Turn off background music' : 'Turn on background music'}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-mist shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-gold/50 hover:bg-gold/10 hover:text-gold-bright hover:shadow-md active:translate-y-0 active:scale-95"
          >
            {musicOn ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3Zm11-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3Zm11-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.4"
                />
                <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSoundOn((prev) => !prev)}
            aria-pressed={soundOn}
            aria-label={soundOn ? 'Mute page-turn sound' : 'Unmute page-turn sound'}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-mist shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-gold/50 hover:bg-gold/10 hover:text-gold-bright hover:shadow-md active:translate-y-0 active:scale-95"
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
        </div>
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
            <div
              className="flex items-center gap-3 sm:gap-6"
              onPointerDownCapture={handleBookInteraction}
              onTouchStartCapture={handleBookInteraction}
              onClickCapture={handleBookInteraction}
            >
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
      className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-parchment/70 shadow-md shadow-black/20 backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-gold/50 hover:bg-gold/10 hover:text-gold-bright hover:shadow-lg hover:shadow-gold/10 active:translate-y-0 active:scale-95 disabled:pointer-events-none disabled:opacity-0 sm:flex"
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
        className="mt-4 rounded-full border border-gold/40 bg-gold/5 px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-gold-bright shadow-md shadow-black/20 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-gold-bright hover:bg-gold/15 hover:shadow-lg hover:shadow-gold/10 active:translate-y-0 active:scale-95"
      >
        Start a new book
      </Link>
    </main>
  )
}
