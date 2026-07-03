import { useCallback, useId, useRef, useState } from 'react'

const MAX_FILE_MB = 50

export default function UploadZone({ onFileSelected, disabled, error }) {
  const [isDragging, setIsDragging] = useState(false)
  const [localError, setLocalError] = useState('')
  const inputRef = useRef(null)
  const inputId = useId()

  const validateAndSend = useCallback(
    (file) => {
      if (!file) return
      if (file.type !== 'application/pdf' && !file.name?.toLowerCase().endsWith('.pdf')) {
        setLocalError('That file isn\u2019t a PDF. Choose a .pdf to bind into a book.')
        return
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setLocalError(`That PDF is larger than ${MAX_FILE_MB}MB. Try a smaller file.`)
        return
      }
      setLocalError('')
      onFileSelected(file)
    },
    [onFileSelected]
  )

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault()
      setIsDragging(false)
      if (disabled) return
      const file = event.dataTransfer.files?.[0]
      validateAndSend(file)
    },
    [disabled, validateAndSend]
  )

  const handleDragOver = useCallback(
    (event) => {
      event.preventDefault()
      if (!disabled) setIsDragging(true)
    },
    [disabled]
  )

  const handleDragLeave = useCallback((event) => {
    event.preventDefault()
    setIsDragging(false)
  }, [])

  // Keyboard-only fallback (Enter/Space). Pointer/touch taps are handled
  // natively by the <label for="..."> association below — that's the part
  // that matters for mobile reliability, see note on the label itself.
  const handleKeyDown = (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && !disabled) {
      event.preventDefault()
      inputRef.current?.click()
    }
  }

  const shownError = error || localError

  return (
    <div className="w-full max-w-sm">
      {/*
        This is a real <label> associated with the file input via
        htmlFor/id, not a div with an onClick that calls input.click().
        Programmatically clicking a hidden file input from JS is known to
        be unreliable on mobile Safari and inside in-app browsers (e.g. a
        messaging app's built-in browser) — a native label/input pairing is
        the pattern mobile browsers handle correctly, since it's the
        browser itself opening the picker rather than a script asking it to.
      */}
      <label
        htmlFor={inputId}
        aria-disabled={disabled}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`group relative block select-none transition-transform duration-500 ease-out ${
          disabled ? 'pointer-events-none cursor-wait' : 'cursor-pointer'
        } ${isDragging ? 'scale-[1.03]' : 'scale-100'}`}
        style={{ aspectRatio: '3 / 4', minHeight: '320px' }}
      >
        {/* Stacked pages peeking from behind the cover */}
        <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-r-md rounded-l-sm bg-parchment-dim/90 shadow-book" />
        <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-r-md rounded-l-sm bg-parchment/95 shadow-book" />

        {/* Cover */}
        <div
          className={`absolute inset-0 rounded-r-md rounded-l-sm bg-gradient-to-br from-wine via-wine-deep to-ink-deep shadow-book ring-1 ring-gold/30 transition-all duration-500 ${
            isDragging ? 'ring-2 ring-gold/70' : ''
          }`}
        >
          <div className="pointer-events-none absolute left-0 top-0 h-full w-3 rounded-l-sm bg-black/25" />
          <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full border transition-all duration-300 ${
                isDragging
                  ? 'border-gold-bright bg-gold-bright/20 scale-110'
                  : 'border-gold/60 bg-white/5 group-hover:border-gold-bright group-hover:bg-gold/10'
              }`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 4v11m0-11 4 4m-4-4-4 4M5 17v1.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V17"
                  stroke="#e3bd72"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <p className="font-display text-2xl italic text-parchment">
                {disabled ? 'Binding your book\u2026' : 'Place your pages here'}
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-mist">
                {disabled ? 'One moment' : 'Drop a PDF, or tap to choose one'}
              </p>
            </div>
          </div>
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => validateAndSend(event.target.files?.[0])}
        />
      </label>

      {shownError && (
        <p role="alert" className="mt-4 text-center text-sm text-blush">
          {shownError}
        </p>
      )}
    </div>
  )
}
