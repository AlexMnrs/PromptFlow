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

interface VoiceWordPosition {
  lineIndex: number
  wordIndex: number
  clean: string
}

interface VoiceCursorMatchOptions {
  lastMatchedWord?: string
  lookaheadWords?: number
  spokenWordLimit?: number
}

export interface VoiceCursorMatch {
  cursorWordIndex: number
  lineIndex: number
  matched: boolean
  matchedWord: string
  matchedWordCount: number
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

export function getVoiceCursorProgress(lines: string[], cursorWordIndex: number) {
  const words = getVoiceWordPositions(lines)

  if (words.length === 0) {
    return {
      lineIndex: 0,
      matchedWordCount: 0,
      wordCount: 0,
    }
  }

  const cursor = clamp(cursorWordIndex, 0, words.length)

  if (cursor >= words.length) {
    const lineIndex = Math.max(0, lines.length - 1)

    return {
      lineIndex,
      matchedWordCount: countLineWords(lines[lineIndex] ?? ''),
      wordCount: countLineWords(lines[lineIndex] ?? ''),
    }
  }

  const currentWord = words[cursor]

  return {
    lineIndex: currentWord.lineIndex,
    matchedWordCount: currentWord.wordIndex,
    wordCount: countLineWords(lines[currentWord.lineIndex] ?? ''),
  }
}

export function getVoiceCursorForLine(lines: string[], lineIndex: number) {
  const targetLine = clamp(lineIndex, 0, Math.max(0, lines.length - 1))
  const words = getVoiceWordPositions(lines)
  const firstWordIndex = words.findIndex((word) => word.lineIndex === targetLine)

  if (firstWordIndex >= 0) {
    return firstWordIndex
  }

  return words.length
}

export function findVoiceCursorMatch(lines: string[], transcript: string, cursorWordIndex: number, options: VoiceCursorMatchOptions = {}): VoiceCursorMatch {
  const words = getVoiceWordPositions(lines)
  const currentProgress = getVoiceCursorProgress(lines, cursorWordIndex)
  const spokenWords = toNormalizedWords(transcript).slice(-(options.spokenWordLimit ?? 8))

  if (words.length === 0 || spokenWords.length === 0) {
    return {
      cursorWordIndex,
      lineIndex: currentProgress.lineIndex,
      matched: false,
      matchedWord: '',
      matchedWordCount: currentProgress.matchedWordCount,
    }
  }

  const cursor = clamp(cursorWordIndex, 0, words.length)

  if (cursor >= words.length) {
    return {
      cursorWordIndex,
      lineIndex: currentProgress.lineIndex,
      matched: false,
      matchedWord: '',
      matchedWordCount: currentProgress.matchedWordCount,
    }
  }

  const lookaheadWords = Math.max(1, options.lookaheadWords ?? 8)
  const phraseMatch = findConsecutiveVoicePhrase(words, spokenWords, cursor, lookaheadWords)
  const nextCursor = phraseMatch?.nextCursor ?? findNearestVoiceWord(words, spokenWords, cursor, Math.min(lookaheadWords, 5), options.lastMatchedWord)

  if (nextCursor !== null) {
    const nextProgress = getVoiceCursorProgress(lines, nextCursor)

    return {
      cursorWordIndex: nextCursor,
      lineIndex: nextProgress.lineIndex,
      matched: true,
      matchedWord: words[nextCursor - 1]?.clean ?? '',
      matchedWordCount: nextProgress.matchedWordCount,
    }
  }

  return {
    cursorWordIndex,
    lineIndex: currentProgress.lineIndex,
    matched: false,
    matchedWord: '',
    matchedWordCount: currentProgress.matchedWordCount,
  }
}

function findConsecutiveVoicePhrase(words: VoiceWordPosition[], spokenWords: string[], cursor: number, lookaheadWords: number) {
  const searchEnd = Math.min(words.length - 1, cursor + lookaheadWords - 1)
  let bestMatch: { nextCursor: number; score: number } | null = null

  for (let scriptStart = cursor; scriptStart <= searchEnd; scriptStart += 1) {
    for (let spokenStart = 0; spokenStart < spokenWords.length; spokenStart += 1) {
      const matchedWordCount = countConsecutiveVoiceWords(words, scriptStart, spokenWords, spokenStart)

      if (matchedWordCount < 2) {
        continue
      }

      const nextCursor = scriptStart + matchedWordCount
      const skippedScriptWords = scriptStart - cursor
      const unusedSpokenTail = spokenWords.length - spokenStart - matchedWordCount
      const score = matchedWordCount * 20 - skippedScriptWords * 3 - unusedSpokenTail

      if (!bestMatch || score > bestMatch.score || (score === bestMatch.score && nextCursor > bestMatch.nextCursor)) {
        bestMatch = { nextCursor, score }
      }
    }
  }

  return bestMatch
}

function countConsecutiveVoiceWords(words: VoiceWordPosition[], scriptStart: number, spokenWords: string[], spokenStart: number) {
  let matchedWordCount = 0

  while (
    scriptStart + matchedWordCount < words.length &&
    spokenStart + matchedWordCount < spokenWords.length &&
    words[scriptStart + matchedWordCount].clean === spokenWords[spokenStart + matchedWordCount]
  ) {
    matchedWordCount += 1
  }

  return matchedWordCount
}

function findNearestVoiceWord(words: VoiceWordPosition[], spokenWords: string[], cursor: number, lookaheadWords: number, lastMatchedWord?: string) {
  const spokenSet = new Set(spokenWords)
  let scriptIndex = cursor
  let checkedWords = 0

  while (scriptIndex < words.length && checkedWords < lookaheadWords) {
    const scriptWord = words[scriptIndex]

    if (spokenSet.has(scriptWord.clean)) {
      if (scriptWord.clean === lastMatchedWord && checkedWords > 0) {
        scriptIndex += 1
        checkedWords += 1
        continue
      }

      return scriptIndex + 1
    }

    scriptIndex += 1
    checkedWords += 1
  }

  return null
}

function toNormalizedWords(value: string) {
  return extractWordTokens(normalizeText(value)).filter(Boolean)
}

function getVoiceWordPositions(lines: string[]) {
  return lines.flatMap((line, lineIndex) =>
    toNormalizedWords(line).map(
      (clean, wordIndex): VoiceWordPosition => ({
        lineIndex,
        wordIndex,
        clean,
      }),
    ),
  )
}

function countLineWords(line: string) {
  return toNormalizedWords(line).length
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

export function fileNameForScript(script: ScriptItem, extension: 'txt' | 'json' | 'mp4' | 'webm') {
  const date = new Date().toISOString().slice(0, 10)
  const safeTitle =
    normalizeText(script.title)
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 44) || 'script'

  return `${safeTitle}-${date}.${extension}`
}
