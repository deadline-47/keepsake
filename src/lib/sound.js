// Page-turn sound.
//
// Preferred sound: a real recorded book-flip sample, loaded from
// `/sounds/page-turn.mp3` (a local file in the `public/sounds/` folder —
// see public/sounds/README.md for where to get one). Loading it locally
// rather than hotlinking a third-party CDN keeps the sound reliable: no
// external host to go down, rate-limit, or change its URL later.
//
// Fallback: if that file is missing (e.g. a fresh checkout before anyone
// has added one) or fails to load, we synthesize a soft paper-flutter
// sound with the Web Audio API instead, so page turns are never silent.

const AUDIO_SRC = '/sounds/page-turn.mp3'
const POOL_SIZE = 4

let pool = []
let poolReady = false
let useFallback = false
let sharedContext = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!sharedContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return null
    try {
      sharedContext = new AudioContextClass()
    } catch {
      // Some mobile browsers (particularly in-app browsers embedded in
      // messaging apps) throw here instead of just failing quietly. This
      // must never bubble up — primeAudio() and playPageTurnSound() are
      // called from the same interaction handler that also starts the
      // background music, and an uncaught throw here would abort that
      // handler before the music code even ran.
      return null
    }
  }
  return sharedContext
}

function ensurePool() {
  if (poolReady || typeof window === 'undefined' || typeof Audio === 'undefined') return
  poolReady = true

  const probe = new Audio()
  probe.addEventListener(
    'error',
    () => {
      useFallback = true
    },
    { once: true }
  )
  probe.preload = 'auto'
  probe.src = AUDIO_SRC

  pool = Array.from({ length: POOL_SIZE }, () => {
    const audio = new Audio(AUDIO_SRC)
    audio.preload = 'auto'
    audio.volume = 0.5
    return audio
  })
}

let poolIndex = 0

function playFromPool(volume) {
  const audio = pool[poolIndex]
  poolIndex = (poolIndex + 1) % pool.length
  try {
    audio.currentTime = 0
    audio.volume = Math.min(Math.max(volume, 0), 1)
    const playPromise = audio.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      // Autoplay restrictions can reject this even from a user gesture in
      // rare cases (e.g. very first interaction on iOS); fall back
      // silently to the synthesized sound rather than throwing.
      playPromise.catch(() => playSynthesizedFlip(volume))
    }
  } catch {
    playSynthesizedFlip(volume)
  }
}

function makeNoiseBuffer(ctx, durationSeconds) {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * durationSeconds))
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i += 1) {
    const decay = 1 - i / bufferSize
    data[i] = (Math.random() * 2 - 1) * decay ** 1.6
  }
  return buffer
}

function playSynthesizedFlip(volume) {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const master = ctx.createGain()
  master.gain.value = Math.min(Math.max(volume, 0), 1)
  master.connect(ctx.destination)

  const noiseDuration = 0.28
  const noise = ctx.createBufferSource()
  noise.buffer = makeNoiseBuffer(ctx, noiseDuration)

  const bandpass = ctx.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.setValueAtTime(1800, now)
  bandpass.frequency.linearRampToValueAtTime(3200, now + noiseDuration)
  bandpass.Q.value = 0.7

  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(0.0001, now)
  noiseGain.gain.linearRampToValueAtTime(1, now + 0.02)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + noiseDuration)

  noise.connect(bandpass)
  bandpass.connect(noiseGain)
  noiseGain.connect(master)

  const tap = ctx.createOscillator()
  tap.type = 'sine'
  tap.frequency.setValueAtTime(220, now + noiseDuration * 0.7)
  tap.frequency.exponentialRampToValueAtTime(120, now + noiseDuration + 0.1)

  const tapGain = ctx.createGain()
  tapGain.gain.setValueAtTime(0.0001, now + noiseDuration * 0.7)
  tapGain.gain.linearRampToValueAtTime(0.5, now + noiseDuration * 0.75)
  tapGain.gain.exponentialRampToValueAtTime(0.0001, now + noiseDuration + 0.15)

  tap.connect(tapGain)
  tapGain.connect(master)

  noise.start(now)
  noise.stop(now + noiseDuration + 0.02)
  tap.start(now + noiseDuration * 0.7)
  tap.stop(now + noiseDuration + 0.2)
}

/** Must be called from a user gesture handler to unlock audio on iOS/Safari. */
export function primeAudio() {
  // This is deliberately paranoid: primeAudio() is called from the same
  // interaction handler that also starts the background music, and this
  // function existing purely to help the page-turn *sound effect* must
  // never be able to break background *music* by throwing partway through.
  try {
    ensurePool()
    const ctx = getAudioContext()
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
  } catch {
    // Swallow — see above.
  }
}

/**
 * Plays a page-turn sound: the real recorded sample if it's available,
 * otherwise a synthesized paper-flutter as a graceful fallback.
 * @param {number} volume 0..1
 */
export function playPageTurnSound(volume = 0.45) {
  try {
    ensurePool()
    if (useFallback || pool.length === 0) {
      playSynthesizedFlip(volume)
      return
    }
    playFromPool(volume)
  } catch {
    // Never let a page-turn sound failure take down anything else running
    // in the same interaction handler.
  }
}
