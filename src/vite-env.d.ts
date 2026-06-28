/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  start: () => void
  stop: () => void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition
}

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

interface MediaTrackConstraintSet {
  zoom?: number
}

type WakeLockType = 'screen'

interface WakeLockSentinel extends EventTarget {
  readonly released: boolean
  readonly type: WakeLockType
  release: () => Promise<void>
}

interface WakeLock {
  request: (type: WakeLockType) => Promise<WakeLockSentinel>
}

interface Navigator {
  wakeLock?: WakeLock
}
