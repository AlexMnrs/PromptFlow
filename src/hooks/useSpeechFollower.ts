import { useEffect, useRef, useState } from 'react'
import { findVoiceTargetLine, normalizeText } from '../lib/prompter'

type SpeechStatus = 'idle' | 'listening' | 'paused' | 'unsupported' | 'error'

interface SpeechFollowerOptions {
  enabled: boolean
  language: string
  lines: string[]
  currentIndex: number
  commandsEnabled: boolean
  onLineMatched: (index: number) => void
  onCommand: (command: 'next' | 'previous' | 'reset' | 'pause') => void
}

export function useSpeechFollower({
  enabled,
  language,
  lines,
  currentIndex,
  commandsEnabled,
  onLineMatched,
  onCommand,
}: SpeechFollowerOptions) {
  const [status, setStatus] = useState<SpeechStatus>('idle')
  const [transcript, setTranscript] = useState('')
  const [matchingTranscript, setMatchingTranscript] = useState('')
  const [error, setError] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const shouldListenRef = useRef(false)
  const currentIndexRef = useRef(currentIndex)
  const previousIndexRef = useRef(currentIndex)
  const linesRef = useRef(lines)
  const onLineMatchedRef = useRef(onLineMatched)
  const onCommandRef = useRef(onCommand)
  const restartTimerRef = useRef<number | null>(null)
  const networkErrorCountRef = useRef(0)
  const transcriptBufferRef = useRef('')

  useEffect(() => {
    if (previousIndexRef.current !== currentIndex) {
      transcriptBufferRef.current = ''
      setMatchingTranscript('')
      previousIndexRef.current = currentIndex
    }

    currentIndexRef.current = currentIndex
  }, [currentIndex])

  useEffect(() => {
    shouldListenRef.current = enabled
  }, [enabled])

  useEffect(() => {
    linesRef.current = lines
    transcriptBufferRef.current = ''
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
      setMatchingTranscript('')
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

      const cleanFinalSpoken = finalSpoken.trim()

      if (cleanFinalSpoken) {
        transcriptBufferRef.current = `${transcriptBufferRef.current} ${cleanFinalSpoken}`.trim().split(/\s+/).slice(-48).join(' ')
      }

      if (commandsEnabled) {
        const normalized = normalizeText(cleanSpoken)
        const commandWordCount = normalized.split(/\s+/).filter(Boolean).length

        if (commandWordCount <= 3 && /^(siguiente|linea siguiente|next)$/.test(normalized)) {
          onCommandRef.current('next')
          return
        }

        if (commandWordCount <= 3 && /^(anterior|atras|linea anterior|previous|back)$/.test(normalized)) {
          onCommandRef.current('previous')
          return
        }

        if (commandWordCount <= 3 && /^(reiniciar|inicio|reset)$/.test(normalized)) {
          onCommandRef.current('reset')
          return
        }

        if (commandWordCount <= 3 && /^(pausa|pausar|pause)$/.test(normalized)) {
          onCommandRef.current('pause')
          return
        }
      }

      const matchingTranscript = `${transcriptBufferRef.current} ${cleanSpoken}`.trim()
      setMatchingTranscript(matchingTranscript)
      onLineMatchedRef.current(findVoiceTargetLine(linesRef.current, matchingTranscript, currentIndexRef.current))
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
    error,
  }
}

function isRecoverableSpeechError(error: string) {
  return error === 'network' || error === 'no-speech' || error === 'aborted'
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
