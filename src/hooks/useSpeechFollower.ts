import { useEffect, useRef, useState } from 'react'
import { findVoiceCursorMatch, getVoiceCursorForLine, getVoiceCursorProgress, normalizeText } from '../lib/prompter'

type SpeechStatus = 'idle' | 'listening' | 'paused' | 'unsupported' | 'error'

interface SpeechFollowerOptions {
  enabled: boolean
  language: string
  lines: string[]
  currentIndex: number
  commandsEnabled: boolean
  trackingActive: boolean
  onLineMatched: (index: number) => void
  onCommand: (command: 'next' | 'previous' | 'reset' | 'pause') => void
}

export function useSpeechFollower({
  enabled,
  language,
  lines,
  currentIndex,
  commandsEnabled,
  trackingActive,
  onLineMatched,
  onCommand,
}: SpeechFollowerOptions) {
  const [status, setStatus] = useState<SpeechStatus>('idle')
  const [transcript, setTranscript] = useState('')
  const [matchingTranscript, setMatchingTranscript] = useState('')
  const [matchedWordCount, setMatchedWordCount] = useState(0)
  const [error, setError] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const shouldListenRef = useRef(false)
  const currentIndexRef = useRef(currentIndex)
  const previousIndexRef = useRef(currentIndex)
  const linesRef = useRef(lines)
  const onLineMatchedRef = useRef(onLineMatched)
  const onCommandRef = useRef(onCommand)
  const trackingActiveRef = useRef(trackingActive)
  const restartTimerRef = useRef<number | null>(null)
  const networkErrorCountRef = useRef(0)
  const transcriptBufferRef = useRef('')
  const matchedWordCountRef = useRef(0)
  const voiceCursorRef = useRef(getVoiceCursorForLine(lines, currentIndex))
  const lastMatchedWordRef = useRef('')

  useEffect(() => {
    if (previousIndexRef.current !== currentIndex) {
      const cursorProgress = getVoiceCursorProgress(linesRef.current, voiceCursorRef.current)

      if (cursorProgress.lineIndex !== currentIndex) {
        voiceCursorRef.current = getVoiceCursorForLine(linesRef.current, currentIndex)
        lastMatchedWordRef.current = ''
        matchedWordCountRef.current = 0
        setMatchedWordCount(0)
      }

      previousIndexRef.current = currentIndex
    }

    currentIndexRef.current = currentIndex
  }, [currentIndex])

  useEffect(() => {
    shouldListenRef.current = enabled
  }, [enabled])

  useEffect(() => {
    trackingActiveRef.current = trackingActive
  }, [trackingActive])

  useEffect(() => {
    linesRef.current = lines
    transcriptBufferRef.current = ''
    matchedWordCountRef.current = 0
    voiceCursorRef.current = getVoiceCursorForLine(lines, currentIndexRef.current)
    lastMatchedWordRef.current = ''
    setMatchedWordCount(0)
  }, [lines])

  useEffect(() => {
    onLineMatchedRef.current = onLineMatched
  }, [onLineMatched])

  useEffect(() => {
    onCommandRef.current = onCommand
  }, [onCommand])

  useEffect(() => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition

    if (!Recognition) {
      setStatus(enabled ? 'unsupported' : 'idle')
      setError(enabled ? 'El seguimiento por voz no esta disponible en este navegador.' : '')
      return
    }

    if (!enabled) {
      if (restartTimerRef.current !== null) {
        window.clearTimeout(restartTimerRef.current)
        restartTimerRef.current = null
      }
      transcriptBufferRef.current = ''
      matchedWordCountRef.current = 0
      voiceCursorRef.current = getVoiceCursorForLine(linesRef.current, currentIndexRef.current)
      lastMatchedWordRef.current = ''
      setMatchingTranscript('')
      setMatchedWordCount(0)
      recognitionRef.current?.stop()
      setStatus('paused')
      return
    }

    const recognition = new Recognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = language
    recognitionRef.current = recognition
    shouldListenRef.current = true
    networkErrorCountRef.current = 0

    recognition.onstart = () => {
      setStatus('listening')
      setError('')
    }

    recognition.onerror = (event) => {
      if (event.error === 'network') {
        networkErrorCountRef.current += 1

        if (networkErrorCountRef.current >= 3) {
          shouldListenRef.current = false
          setStatus('unsupported')
          setError('El reconocimiento por voz no esta respondiendo en este navegador. Prueba Chrome o Edge para seguimiento automatico.')
          return
        }
      }

      if (shouldListenRef.current && isRecoverableSpeechError(event.error)) {
        setStatus('listening')
        setError('')
        return
      }

      setStatus('error')
      setError(speechErrorText(event.error))
    }

    recognition.onend = () => {
      if (shouldListenRef.current) {
        restartTimerRef.current = window.setTimeout(() => {
          restartTimerRef.current = null

          if (!shouldListenRef.current || recognitionRef.current !== recognition) {
            return
          }

          try {
            recognition.start()
          } catch {
            setStatus('error')
            setError('No se pudo reanudar el reconocimiento de voz.')
          }
        }, 450)
      } else {
        setStatus('paused')
      }
    }

    recognition.onresult = (event) => {
      const spokenParts: string[] = []
      const finalSpokenParts: string[] = []

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const resultTranscript = result[0]?.transcript ?? ''

        spokenParts.push(resultTranscript)

        if (result.isFinal) {
          finalSpokenParts.push(resultTranscript)
        }
      }

      const spoken = spokenParts.join(' ')
      const cleanSpoken = spoken.trim()

      if (!cleanSpoken) {
        return
      }

      setTranscript(cleanSpoken)

      if (!trackingActiveRef.current) {
        return
      }

      const finalSpoken = finalSpokenParts.join(' ')
      const cleanFinalSpoken = finalSpoken.trim()

      if (cleanFinalSpoken) {
        transcriptBufferRef.current = `${transcriptBufferRef.current} ${cleanFinalSpoken}`.trim().split(/\s+/).slice(-48).join(' ')
      }

      if (commandsEnabled) {
        const command = parseVoiceCommand(cleanSpoken)

        if (command) {
          onCommandRef.current(command)
          return
        }
      }

      const match = findVoiceCursorMatch(linesRef.current, cleanSpoken, voiceCursorRef.current, {
        lastMatchedWord: lastMatchedWordRef.current,
        lookaheadWords: 5,
        spokenWordLimit: 5,
      })
      const cursorProgress = getVoiceCursorProgress(linesRef.current, match.cursorWordIndex)

      if (match.matched) {
        voiceCursorRef.current = match.cursorWordIndex
        lastMatchedWordRef.current = match.matchedWord
      }

      currentIndexRef.current = cursorProgress.lineIndex
      matchedWordCountRef.current = cursorProgress.matchedWordCount
      const matchingTranscript = `${transcriptBufferRef.current} ${cleanSpoken}`.trim()
      setMatchingTranscript(matchingTranscript)
      setMatchedWordCount(matchedWordCountRef.current)
      onLineMatchedRef.current(cursorProgress.lineIndex)
    }

    try {
      recognition.start()
    } catch {
      setStatus('error')
      setError('No se pudo iniciar el reconocimiento de voz.')
    }

    return () => {
      shouldListenRef.current = false
      if (restartTimerRef.current !== null) {
        window.clearTimeout(restartTimerRef.current)
        restartTimerRef.current = null
      }
      recognition.stop()
    }
  }, [commandsEnabled, enabled, language])

  return {
    status,
    transcript,
    matchingTranscript,
    matchedWordCount,
    error,
  }
}

function parseVoiceCommand(value: string): 'next' | 'previous' | 'reset' | 'pause' | null {
  const words = normalizeText(value).split(/\s+/).filter(Boolean)

  if (words[0] !== 'flow' || words.length > 4) {
    return null
  }

  const command = words.slice(1).join(' ')

  if (/^(avanza|avanzar|siguiente|linea siguiente|next)$/.test(command)) {
    return 'next'
  }

  if (/^(atras|anterior|retrocede|linea anterior|previous|back)$/.test(command)) {
    return 'previous'
  }

  if (/^(reinicia|reiniciar|inicio|reset)$/.test(command)) {
    return 'reset'
  }

  if (/^(pausa|pausar|pause)$/.test(command)) {
    return 'pause'
  }

  return null
}

function isRecoverableSpeechError(error: string) {
  return error === 'network' || error === 'no-speech' || error === 'aborted'
}

function speechErrorText(error: string) {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return 'Allow microphone access to use voice-following.'
  }

  if (error === 'audio-capture') {
    return 'No microphone was detected.'
  }

  return error || 'No se pudo continuar escuchando.'
}
