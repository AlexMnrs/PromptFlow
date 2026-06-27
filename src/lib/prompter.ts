import type { ScriptItem } from '../types'

const sentenceBreak = /(?<=[.!?])\s+|\n+/g

export function splitScript(body: string) {
  const chunks = body
    .split(sentenceBreak)
    .map((line) => line.trim())
    .filter(Boolean)

  return chunks.length > 0 ? chunks : ['Escribe o importa un guion para empezar.']
}

export function countWords(body: string) {
  return normalizeText(body).split(/\s+/).filter(Boolean).length
}

export function estimateMinutes(body: string, speed = 1) {
  const wordsPerMinute = 145 * speed
  return Math.max(1, Math.ceil(countWords(body) / wordsPerMinute))
}

export function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function findBestLineIndex(lines: string[], transcript: string, currentIndex: number) {
  const transcriptWords = normalizeText(transcript).split(/\s+/).filter(Boolean).slice(-34)

  if (transcriptWords.length < 3) {
    return currentIndex
  }

  const transcriptText = transcriptWords.join(' ')
  const transcriptSet = new Set(transcriptWords)
  let bestIndex = currentIndex
  let bestScore = 0
  const start = Math.max(0, currentIndex - 2)
  const end = Math.min(lines.length - 1, currentIndex + 10)

  for (let index = start; index <= end; index += 1) {
    const lineWords = normalizeText(lines[index]).split(/\s+/).filter((word) => word.length > 2)

    if (lineWords.length === 0) {
      continue
    }

    let hits = 0
    let recency = 0

    for (const word of lineWords) {
      if (!transcriptSet.has(word)) {
        continue
      }

      const position = transcriptWords.lastIndexOf(word)
      hits += 1
      recency += (position + 1) / transcriptWords.length
    }

    const windowBonus = buildWordWindows(lineWords, Math.min(5, lineWords.length)).some((window) => transcriptText.includes(window)) ? 0.32 : 0
    const recencyBonus = hits > 0 ? (recency / hits) * 0.2 : 0
    const progressBonus = index > currentIndex ? Math.min(index - currentIndex, 3) * 0.03 : 0
    const score = hits / Math.min(lineWords.length, 8) + windowBonus + recencyBonus + progressBonus

    if (score > bestScore) {
      bestIndex = index
      bestScore = score
    }
  }

  return bestScore >= 0.34 ? bestIndex : currentIndex
}

function buildWordWindows(words: string[], size: number) {
  if (words.length < size || size < 2) {
    return []
  }

  return words.slice(0, -size + 1).map((_, index) => words.slice(index, index + size).join(' '))
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)

  return `${minutes.toString().padStart(2, '0')}:${rest.toString().padStart(2, '0')}`
}

export function fileNameForScript(script: ScriptItem, extension: 'txt' | 'mp4' | 'webm') {
  const date = new Date().toISOString().slice(0, 10)
  const safeTitle =
    normalizeText(script.title)
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 44) || 'guion'

  return `${safeTitle}-${date}.${extension}`
}
