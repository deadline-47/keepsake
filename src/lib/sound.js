// A small self-contained "page turn" sound designed with the Web Audio API.
// Synthesizing it avoids shipping a binary asset and avoids any licensing
// question around a sampled sound effect — it's built from noise + filters
// to mimic the soft crinkle-and-whoosh of a paper page turning.

let sharedContext = null

function getContext() {
  if (typeof window === 'undefined') return null
  if (!sharedContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return null
    sharedContext = new AudioContextClass()
  }
  return sharedContext
}

/** Must be called from a user gesture handler on iOS/Safari to unlock audio. */
export function primeAudio() {
  const ctx = getContext()
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
}

function makeNoiseBuffer(ctx, durationSeconds) {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * durationSeconds))
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i += 1) {
    // Exponential decay envelope applied to white noise, so the burst
    // sounds like a quick paper flutter rather than a flat hiss.
    const decay = 1 - i / bufferSize
    data[i] = (Math.random() * 2 - 1) * decay ** 1.6
  }
  return buffer
}

/**
 * Plays a short synthesized page-turn sound: a filtered noise "flutter"
 * plus a soft tonal "tap" for the moment the page settles.
 * @param {number} volume 0..1
 */
export function playPageTurnSound(volume = 0.35) {
  const ctx = getContext()
  if (!ctx) return
  primeAudio()

  const now = ctx.currentTime
  const master = ctx.createGain()
  master.gain.value = Math.min(Math.max(volume, 0), 1)
  master.connect(ctx.destination)

  // --- Paper flutter (filtered noise burst) ---
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

  // --- Soft settle "tap" ---
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
