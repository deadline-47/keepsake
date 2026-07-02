import { useEffect, useRef, useState } from 'react'

/**
 * The app's signature interaction: a gold wax seal that "stamps" down when
 * pressed and unfurls a ribbon confirming the link has been copied.
 */
export default function ShareSeal({ url }) {
  const [state, setState] = useState('idle') // idle | stamping | copied | failed
  const timeoutRef = useRef(null)

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  const handleClick = async () => {
    if (state === 'stamping') return
    setState('stamping')

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = url
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      window.setTimeout(() => setState('copied'), 320)
    } catch {
      window.setTimeout(() => setState('failed'), 320)
    }

    clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => setState('idle'), 3200)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        aria-label="Copy the shareable link to this book"
        className={`group relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gold-bright to-gold text-ink-deep shadow-seal transition-all duration-300 ease-out focus-visible:outline-none ${
          state === 'stamping'
            ? 'scale-90'
            : 'hover:-translate-y-0.5 hover:scale-105 hover:shadow-lg hover:shadow-gold/30 active:translate-y-0 active:scale-90'
        }`}
      >
        <span className="absolute inset-0 rounded-full ring-1 ring-white/40" />
        {state === 'copied' ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 13l4 4 10-10"
              stroke="#1c1220"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M8 12a3 3 0 1 0-2.83-4H5a3 3 0 1 0 3 4Zm8 0a3 3 0 1 0 2.83 4H19a3 3 0 1 0-3-4Zm-7.6 1.6 7.2 4M15.6 6.4l-7.2 4"
              stroke="#1c1220"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
      <p className="h-4 text-xs uppercase tracking-[0.2em] text-mist" aria-live="polite">
        {state === 'copied' && 'Link copied'}
        {state === 'failed' && 'Copy failed \u2014 try again'}
        {state === 'idle' && 'Copy link'}
        {state === 'stamping' && 'Sealing\u2026'}
      </p>
    </div>
  )
}
