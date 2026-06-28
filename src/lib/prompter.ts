import type { ScriptItem } from '../types'

const sentenceBreak = /(?<=[.!?])\s+|\n+/g

export function splitScript(body: string) {
  const chunks = body
    .split(sentenceBreak)
    .map((line) => line.trim())
    .filter(Boolean)

  return chunks.length > 0 ? chunks : ['Write or import a script to get started.']
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

interface VoiceProgressOptions {
  cursorWordCount?: number
  fixedMatchedWordCount?: number
  allowBacktrack?: boolean
  maxAdvanceWords?: number
  minMatchedWordCount?: number
}

export function findBestLineIndex(lines: string[], transcript: string, currentIndex: number, currentMatchedWordCount = 0) {
  const transcriptWords = toNormalizedWords(transcript).slice(-34)

  if (transcriptWords.length < 3) {
    return currentIndex
  }

  let bestIndex = currentIndex
  let bestScore = 0
  const start = currentIndex
  const end = currentIndex

  for (let index = start; index <= end; index += 1) {
    const progress = getLineVoiceProgress(lines[index], transcript, {
      minMatchedWordCount: index === currentIndex ? currentMatchedWordCount : 0,
    })

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

export function findVoiceTargetLine(lines: string[], transcript: string, currentIndex: number, currentMatchedWordCount = 0) {
  const currentProgress = getLineVoiceProgress(lines[currentIndex] ?? '', transcript, { fixedMatchedWordCount: currentMatchedWordCount })

  if (currentIndex < lines.length - 1 && shouldAdvanceFromLine(currentProgress)) {
    return currentIndex + 1
  }

  return findBestLineIndex(lines, transcript, currentIndex, currentProgress.matchedWordCount)
}

export function getLineVoiceProgress(line: string, transcript: string, options: VoiceProgressOptions = {}) {
  const lineWords = toNormalizedWords(line)
  const transcriptWords = toNormalizedWords(transcript).slice(-60)
  const matchedWordCount = getMatchedWordCount(lineWords, transcriptWords, options)
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

function getMatchedWordCount(lineWords: string[], transcriptWords: string[], options: VoiceProgressOptions) {
  if (options.fixedMatchedWordCount !== undefined) {
    return clamp(options.fixedMatchedWordCount, 0, lineWords.length)
  }

  if (options.cursorWordCount !== undefined) {
    return findNearbyPhraseEnd(lineWords, transcriptWords, options)
  }

  const minMatchedWordCount = clamp(options.minMatchedWordCount ?? 0, 0, lineWords.length)

  return countOrderedPrefixMatches(lineWords, transcriptWords, minMatchedWordCount)
}

function findNearbyPhraseEnd(lineWords: string[], transcriptWords: string[], options: VoiceProgressOptions) {
  const cursor = clamp(options.cursorWordCount ?? 0, 0, lineWords.length)
  const spokenWords = transcriptWords.slice(-8)

  if (spokenWords.length === 0 || lineWords.length === 0) {
    return cursor
  }

  const backtrack = options.allowBacktrack ? lineWords.length : 0
  const searchStart = Math.max(0, cursor - backtrack)
  const searchEnd = Math.min(lineWords.length - 1, cursor + 8)
  let bestEnd = cursor
  let bestScore = 0

  for (let start = searchStart; start <= searchEnd; start += 1) {
    const matched = countConsecutiveMatches(lineWords, spokenWords, start)

    if (matched === 0) {
      continue
    }

    const end = start + matched
    const distance = Math.abs(start - cursor)
    const score = matched * 2 - distance * 0.2

    if (score > bestScore) {
      bestEnd = end
      bestScore = score
    }
  }

  if (bestScore === 0) {
    return findNearbySpokenWordEnd(lineWords, spokenWords, cursor, options)
  }

  if (bestEnd > cursor && options.maxAdvanceWords !== undefined) {
    return Math.min(bestEnd, cursor + options.maxAdvanceWords)
  }

  return bestEnd
}

function findNearbySpokenWordEnd(lineWords: string[], spokenWords: string[], cursor: number, options: VoiceProgressOptions) {
  const spokenSet = new Set(spokenWords)
  const searchEnd = Math.min(lineWords.length - 1, cursor + 5)

  for (let index = cursor; index <= searchEnd; index += 1) {
    if (spokenSet.has(lineWords[index])) {
      const matchedEnd = index + 1

      if (matchedEnd > cursor && options.maxAdvanceWords !== undefined) {
        return Math.min(matchedEnd, cursor + options.maxAdvanceWords)
      }

      return matchedEnd
    }
  }

  return cursor
}

function countConsecutiveMatches(lineWords: string[], transcriptWords: string[], lineStart: number) {
  let matched = 0

  for (const transcriptWord of transcriptWords) {
    const lineIndex = lineStart + matched

    if (lineIndex >= lineWords.length || lineWords[lineIndex] !== transcriptWord) {
      break
    }

    matched += 1
  }

  return matched
}

function shouldAdvanceFromLine(progress: ReturnType<typeof getLineVoiceProgress>) {
  return progress.wordCount > 0 && progress.matchedWordCount >= progress.wordCount
}

function countOrderedPrefixMatches(lineWords: string[], transcriptWords: string[], startIndex = 0) {
  let matched = startIndex

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
      .slice(0, 44) || 'script'

  return `${safeTitle}-${date}.${extension}`
}
