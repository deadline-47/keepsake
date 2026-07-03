import { useCallback, useEffect, useRef, useState } from 'react'

const FADE_MS = 1200

/**
 * Manages a small looping playlist for ambient background music: plays
 * track 1 -> 2 -> 3 -> back to 1 forever, with a soft fade in/out instead
 * of an abrupt start/stop, at a low fixed volume.
 *
 * Playback only ever starts from `arm()`, which you call directly inside a
 * real user gesture handler (a click, a tap) — browsers refuse to start
 * audio before the visitor has interacted with the page at all, so this
 * can't be triggered automatically on load.
 *
 * @param {string[]} tracks Paths to the audio files, e.g. ['/music/track-1.mp3', ...]
 * @param {number} volume Target volume once faded in, 0..1
 */
export function useBackgroundPlaylist(tracks, volume = 0.14) {
  const audioRef = useRef(null)
  const trackIndexRef = useRef(0)
  const failCountRef = useRef(0)
  const fadeFrameRef = useRef(null)
  const [enabled, setEnabled] = useState(true)
  const [armed, setArmed] = useState(false)

  const fadeTo = useCallback((target) => {
    const audio = audioRef.current
    if (!audio) return
    cancelAnimationFrame(fadeFrameRef.current)
    const start = audio.volume
    const startTime = performance.now()

    function step(now) {
      const progress = Math.min(1, (now - startTime) / FADE_MS)
      audio.volume = start + (target - start) * progress
      if (progress < 1) {
        fadeFrameRef.current = requestAnimationFrame(step)
      }
    }
    fadeFrameRef.current = requestAnimationFrame(step)
  }, [])

  const loadAndPlay = useCallback(
    (index) => {
      const audio = audioRef.current
      if (!audio || tracks.length === 0) return
      audio.src = tracks[index]
      audio.volume = 0
      audio
        .play()
        .then(() => fadeTo(volume))
        .catch(() => {
          // Autoplay was refused (rare once armed, since arm() is always
          // called from a gesture) — just leave it silent rather than
          // throwing; the toggle button still lets her retry.
        })
    },
    [tracks, volume, fadeTo]
  )

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'auto'
    audio.volume = 0
    audioRef.current = audio

    const handleEnded = () => {
      trackIndexRef.current = (trackIndexRef.current + 1) % tracks.length
      loadAndPlay(trackIndexRef.current)
    }

    const handlePlaying = () => {
      failCountRef.current = 0
    }

    const handleError = () => {
      // A missing/undecodable file — skip to the next track instead of
      // getting stuck silent forever. Stops once every track has failed
      // once, so it can't loop endlessly if none of the files exist yet.
      failCountRef.current += 1
      if (failCountRef.current < tracks.length) {
        trackIndexRef.current = (trackIndexRef.current + 1) % tracks.length
        loadAndPlay(trackIndexRef.current)
      }
    }

    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('playing', handlePlaying)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('playing', handlePlaying)
      audio.removeEventListener('error', handleError)
      audio.pause()
      audio.src = ''
      cancelAnimationFrame(fadeFrameRef.current)
    }
    // Intentionally runs once — `tracks` is expected to be a stable list
    // for the lifetime of the book page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Call this directly inside a click/tap handler to start playback. */
  const arm = useCallback(() => {
    if (armed || !enabled || tracks.length === 0) return
    setArmed(true)
    loadAndPlay(trackIndexRef.current)
  }, [armed, enabled, tracks.length, loadAndPlay])

  /** Mute/unmute without losing playlist position. */
  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      const audio = audioRef.current
      if (audio && armed) {
        if (next) {
          audio.play().catch(() => {})
          fadeTo(volume)
        } else {
          fadeTo(0)
          window.setTimeout(() => audio.pause(), FADE_MS + 50)
        }
      }
      return next
    })
  }, [armed, volume, fadeTo])

  return { enabled, arm, toggle }
}
