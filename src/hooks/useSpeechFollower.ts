import { useEffect, useRef, useState } from 'react'
import { findVoiceTargetLine, getLineVoiceProgress, normalizeText } from '../lib/prompter'

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
  const sessionStartedAtRef = useRef(0)
  const sessionHadResultRef = useRef(false)
  const transcriptBufferRef = useRef('')
  const matchedWordCountRef = useRef(0)

  useEffect(() => {
    if (previousIndexRef.current !== currentIndex) {
      transcriptBufferRef.current = ''
      matchedWordCountRef.current = 0
      setMatchingTranscript('')
      setMatchedWordCount(0)
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
      setMatchingTranscript('')
      setMatchedWordCount(0)
      recognitionRef.current?.stop()
      setStatus('paused')
      return
    }

    const recognition = new Recognition()
    recognition.continuous = !isAndroidBrowser()
    recognition.interimResults = true
    recognition.lang = language
    recognitionRef.current = recognition
    shouldListenRef.current = true
    networkErrorCountRef.current = 0

    recognition.onstart = () => {
      sessionStartedAtRef.current = Date.now()
      sessionHadResultRef.current = false
      setStatus('listening')
      setError('')
    }

    recognition.onerror = (event) => {
      if (event.error === 'aborted') {
        if (shouldListenRef.current) {
          shouldListenRef.current = false
          setStatus('paused')
          setError('')
        }

        return
      }

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
        const endedQuicklyWithoutResults = isAndroidBrowser() && !sessionHadResultRef.current && Date.now() - sessionStartedAtRef.current < 2500

        if (endedQuicklyWithoutResults) {
          shouldListenRef.current = false
          setStatus('error')
          setError('Android ha cerrado el reconocimiento de voz al iniciarlo. Prueba Chrome o desactiva permisos de microfono/camara abiertos en otras apps.')
          return
        }

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
      sessionHadResultRef.current = true
      let spoken = ''
      let finalSpoken = ''

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const resultTranscript = result[0]?.transcript ?? ''

        spoken += resultTranscript

        if (result.isFinal) {
          finalSpoken += resultTranscript
        }
      }

      const cleanSpoken = spoken.trim()

      if (!cleanSpoken) {
        return
      }

      setTranscript(cleanSpoken)

      if (!trackingActiveRef.current) {
        return
      }

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

      const matchingTranscript = `${transcriptBufferRef.current} ${cleanSpoken}`.trim()
      const progress = getLineVoiceProgress(linesRef.current[currentIndexRef.current] ?? '', cleanSpoken, {
        allowBacktrack: true,
        cursorWordCount: matchedWordCountRef.current,
        maxAdvanceWords: 1,
      })
      const targetLine = findVoiceTargetLine(linesRef.current, cleanSpoken, currentIndexRef.current, progress.matchedWordCount)
      const targetProgress =
        targetLine === currentIndexRef.current
          ? progress
          : getLineVoiceProgress(linesRef.current[targetLine] ?? '', cleanSpoken, {
              cursorWordCount: 0,
              maxAdvanceWords: 1,
            })

      matchedWordCountRef.current = targetProgress.matchedWordCount
      setMatchingTranscript(matchingTranscript)
      setMatchedWordCount(matchedWordCountRef.current)
      onLineMatchedRef.current(targetLine)
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
  return error === 'network' || error === 'no-speech'
}

function isAndroidBrowser() {
  return /Android/i.test(navigator.userAgent)
}

function speechErrorText(error: string) {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return 'Permite el microfono para usar el seguimiento por voz.'
  }

  if (error === 'audio-capture') {
    return 'No se detecto ningun microfono disponible.'
  }

  return error || 'No se pudo continuar escuchando.'
}
