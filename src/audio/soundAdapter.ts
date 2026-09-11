export type SoundEvent = 'placeJelly' | 'placeMark' | 'error' | 'clear' | 'button'

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const AudioContextConstructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextConstructor) return null
    audioContext ??= new AudioContextConstructor()
    return audioContext
  } catch {
    return null
  }
}

export function playSound(event: SoundEvent, enabled: boolean): void {
  if (!enabled) return
  const context = getAudioContext()
  if (!context) return
  try {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const settings: Record<SoundEvent, { frequency: number; duration: number; type: OscillatorType }> = {
      placeJelly: { frequency: 540, duration: 0.1, type: 'sine' },
      placeMark: { frequency: 260, duration: 0.07, type: 'sine' },
      error: { frequency: 170, duration: 0.16, type: 'triangle' },
      clear: { frequency: 720, duration: 0.34, type: 'sine' },
      button: { frequency: 380, duration: 0.06, type: 'sine' },
    }
    const { frequency, duration, type } = settings[event]
    oscillator.type = type
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.05, context.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + duration + 0.02)
  } catch {
    // Sound is an enhancement; unsupported browsers should stay silent.
  }
}

export function vibrate(pattern: number | number[], enabled: boolean): void {
  if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(pattern)
  } catch {
    // Some browsers expose vibrate but still reject it outside a user gesture.
  }
}
