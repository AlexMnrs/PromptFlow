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
  const transcriptWords = toNormalizedWords(transcript).slice(-34)

  if (transcriptWords.length < 3) {
    return currentIndex
  }

  let bestIndex = currentIndex
  let bestScore = 0
  const start = Math.max(0, currentIndex - 1)
  const end = Math.min(lines.length - 1, currentIndex + 3)

  for (let index = start; index <= end; index += 1) {
    const progress = getLineVoiceProgress(lines[index], transcript)

    if (progress.wordCount === 0) {
      continue
    }

    const distancePenalty = Math.max(0, index - currentIndex) * 0.08
    const score = progress.coverage + progress.trailingMatched * 0.04 - distancePenalty

    if (score > bestScore) {
      bestIndex = index
      bestScore = score
    }
  }

  return bestScore >= 0.3 ? bestIndex : currentIndex
}

export function findVoiceTargetLine(lines: string[], transcript: string, currentIndex: number) {
  const currentProgress = getLineVoiceProgress(lines[currentIndex] ?? '', transcript)
  const nextIndex = currentIndex + 1
  const nextProgress = getLineVoiceProgress(lines[nextIndex] ?? '', transcript)

  if (nextIndex < lines.length && startsNextLine(nextProgress)) {
    return nextIndex
  }

  if (currentIndex < lines.length - 1 && shouldAdvanceFromLine(currentProgress)) {
    return currentIndex + 1
  }

  return findBestLineIndex(lines, transcript, currentIndex)
}

export function getLineVoiceProgress(line: string, transcript: string) {
  const lineWords = toNormalizedWords(line)
  const transcriptWords = toNormalizedWords(transcript).slice(-60)
  const matchedWordCount = countOrderedPrefixMatches(lineWords, transcriptWords)
  const matchedIndexes = new Set<number>()

  for (let index = 0; index < matchedWordCount; index += 1) {
    matchedIndexes.add(index)
  }

  const coverage = lineWords.length === 0 ? 0 : matchedWordCount / lineWords.length
  const trailingMatched = countTrailingMatches(lineWords, matchedIndexes)

  return {
    coverage,
    matchedIndexes,
    matchedWordCount,
    trailingMatched,
    wordCount: lineWords.length,
  }
}

export function extractWordTokens(line: string) {
  return line.match(/[\p{L}\p{N}]+/gu) ?? []
}

function toNormalizedWords(value: string) {
  return extractWordTokens(normalizeText(value)).filter(Boolean)
}

function shouldAdvanceFromLine(progress: ReturnType<typeof getLineVoiceProgress>) {
  if (progress.wordCount <= 3) {
    return progress.coverage >= 1
  }

  return progress.coverage >= 0.82 || (progress.coverage >= 0.66 && progress.trailingMatched >= 4)
}

function startsNextLine(progress: ReturnType<typeof getLineVoiceProgress>) {
  if (progress.wordCount === 0) {
    return false
  }

  return progress.matchedWordCount >= Math.min(3, progress.wordCount) || progress.coverage >= 0.32
}

function countOrderedPrefixMatches(lineWords: string[], transcriptWords: string[]) {
  let matched = 0

  for (const transcriptWord of transcriptWords) {
    if (matched >= lineWords.length) {
      break
    }

    if (matchesLineWord(lineWords, matched, transcriptWord)) {
      matched += 1
      continue
    }

    if (matchesJoinedLineWords(lineWords, matched, transcriptWord)) {
      matched += 2
    }
  }

  return matched
}

function matchesLineWord(lineWords: string[], index: number, transcriptWord: string) {
  return lineWords[index] === transcriptWord
}

function matchesJoinedLineWords(lineWords: string[], index: number, transcriptWord: string) {
  return index + 1 < lineWords.length && `${lineWords[index]}${lineWords[index + 1]}` === transcriptWord
}

function countTrailingMatches(words: string[], matchedIndexes: Set<number>) {
  let count = 0

  for (let index = words.length - 1; index >= 0; index -= 1) {
    if (words[index].length <= 2) {
      continue
    }

    if (!matchedIndexes.has(index)) {
      break
    }

    count += 1
  }

  return count
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
