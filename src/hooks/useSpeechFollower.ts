import { useEffect, useRef, useState } from 'react'
import { findBestLineIndex, normalizeText } from '../lib/prompter'

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
  const [error, setError] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const shouldListenRef = useRef(false)
  const currentIndexRef = useRef(currentIndex)

  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  useEffect(() => {
    shouldListenRef.current = enabled
  }, [enabled])

  useEffect(() => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition

    if (!Recognition) {
      setStatus(enabled ? 'unsupported' : 'idle')
      setError(enabled ? 'El seguimiento por voz no esta disponible en este navegador.' : '')
      return
    }

    if (!enabled) {
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

    recognition.onstart = () => {
      setStatus('listening')
      setError('')
    }

    recognition.onerror = (event) => {
      setStatus('error')
      setError(event.error || 'No se pudo continuar escuchando.')
    }

    recognition.onend = () => {
      if (shouldListenRef.current) {
        window.setTimeout(() => {
          try {
            recognition.start()
          } catch {
            setStatus('error')
          }
        }, 450)
      } else {
        setStatus('paused')
      }
    }

    recognition.onresult = (event) => {
      let spoken = ''

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        spoken += event.results[index][0]?.transcript ?? ''
      }

      const cleanSpoken = spoken.trim()

      if (!cleanSpoken) {
        return
      }

      setTranscript(cleanSpoken)

      if (commandsEnabled) {
        const normalized = normalizeText(cleanSpoken)

        if (/\b(siguiente|next)\b/.test(normalized)) {
          onCommand('next')
          return
        }

        if (/\b(anterior|atras|previous|back)\b/.test(normalized)) {
          onCommand('previous')
          return
        }

        if (/\b(reiniciar|inicio|reset)\b/.test(normalized)) {
          onCommand('reset')
          return
        }

        if (/\b(pausa|pausar|pause)\b/.test(normalized)) {
          onCommand('pause')
          return
        }
      }

      onLineMatched(findBestLineIndex(lines, cleanSpoken, currentIndexRef.current))
    }

    try {
      recognition.start()
    } catch {
      setStatus('error')
      setError('No se pudo iniciar el reconocimiento de voz.')
    }

    return () => {
      shouldListenRef.current = false
      recognition.stop()
    }
  }, [commandsEnabled, enabled, language, lines, onCommand, onLineMatched])

  return {
    status,
    transcript,
    error,
  }
}
