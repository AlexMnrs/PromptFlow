import type { ScriptItem } from '../types'

const sentenceBreak = /(?<=[.!?])\s+|\n+/g
const digitWords = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
const teenWords = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve']
const twentyWords = ['veinte', 'veintiuno', 'veintidos', 'veintitres', 'veinticuatro', 'veinticinco', 'veintiseis', 'veintisiete', 'veintiocho', 'veintinueve']
const tensWords = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const hundredWords = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']
const numberWordSequencesCache = new Map<string, string[][]>()

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
  recoveryLookaheadWords?: number
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
  const spokenWords = toNormalizedWords(transcript).slice(-(options.spokenWordLimit ?? 5))
  const spokenSet = new Set(spokenWords)

  if (words.length === 0 || spokenSet.size === 0) {
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

  const nearLookaheadWords = getLineBoundedLookahead(words, cursor, Math.max(1, options.lookaheadWords ?? 5))
  const nearMatch = findSpokenWordInWindow(lines, words, spokenWords, spokenSet, cursor, 0, nearLookaheadWords, options)
  const recoveryLookaheadWords = getLineBoundedLookahead(words, cursor, Math.max(nearLookaheadWords, options.recoveryLookaheadWords ?? 18))

  if (canRecoverSkippedWords(currentProgress) && recoveryLookaheadWords > nearLookaheadWords) {
    const recoveryMatch = findSpokenWordInWindow(
      lines,
      words,
      spokenWords,
      spokenSet,
      cursor,
      nearLookaheadWords,
      recoveryLookaheadWords,
      options,
      (word) => isReliableSkipWord(word) && matchesScriptWordInRecentTranscript(word, spokenWords),
    )

    if (recoveryMatch && (!nearMatch || shouldPreferRecoveryMatch(nearMatch, recoveryMatch))) {
      return recoveryMatch
    }
  }

  if (canAdvanceToNextLine(currentProgress)) {
    const nextLineMatch = findNextLineStartMatch(lines, words, spokenWords, spokenSet, cursor, options)

    if (nextLineMatch && (!nearMatch || nextLineMatch.matchedWordCount > nearMatch.matchedWordCount)) {
      return nextLineMatch
    }
  }

  if (nearMatch) {
    return nearMatch
  }

  return {
    cursorWordIndex,
    lineIndex: currentProgress.lineIndex,
    matched: false,
    matchedWord: '',
    matchedWordCount: currentProgress.matchedWordCount,
  }
}

function findSpokenWordInWindow(
  lines: string[],
  words: VoiceWordPosition[],
  spokenWords: string[],
  spokenSet: Set<string>,
  cursor: number,
  startOffset: number,
  endOffset: number,
  options: VoiceCursorMatchOptions,
  canUseWord: (word: string) => boolean = () => true,
) {
  let checkedWords = startOffset
  let scriptIndex = cursor + startOffset

  while (scriptIndex < words.length && checkedWords < endOffset) {
    const scriptWord = words[scriptIndex]

    if (matchesScriptWordInTranscript(scriptWord.clean, spokenWords, spokenSet) && canUseWord(scriptWord.clean)) {
      if (scriptWord.clean === options.lastMatchedWord && checkedWords > 0) {
        scriptIndex += 1
        checkedWords += 1
        continue
      }

      const nextCursor = scriptIndex + 1
      const nextProgress = getVoiceCursorProgress(lines, nextCursor)

      return {
        cursorWordIndex: nextCursor,
        lineIndex: nextProgress.lineIndex,
        matched: true,
        matchedWord: scriptWord.clean,
        matchedWordCount: nextProgress.matchedWordCount,
      }
    }

    scriptIndex += 1
    checkedWords += 1
  }

  return null
}

function findNextLineStartMatch(
  lines: string[],
  words: VoiceWordPosition[],
  spokenWords: string[],
  spokenSet: Set<string>,
  cursor: number,
  options: VoiceCursorMatchOptions,
) {
  const currentWord = words[cursor]

  if (!currentWord) {
    return null
  }

  const nextLineStart = words.findIndex((word, index) => index > cursor && word.lineIndex === currentWord.lineIndex + 1)

  if (nextLineStart < 0) {
    return null
  }

  const lookaheadWords = getLineBoundedLookahead(words, nextLineStart, Math.max(1, options.lookaheadWords ?? 5))
  const nextLineWords = words.slice(nextLineStart, nextLineStart + lookaheadWords).map((word) => word.clean)
  const prefixMatchCount = countRecentLinePrefixMatches(nextLineWords, spokenWords)

  if (isReliableNextLinePrefix(nextLineWords, prefixMatchCount)) {
    const nextCursor = nextLineStart + prefixMatchCount
    const nextProgress = getVoiceCursorProgress(lines, nextCursor)

    return {
      cursorWordIndex: nextCursor,
      lineIndex: nextProgress.lineIndex,
      matched: true,
      matchedWord: nextLineWords[prefixMatchCount - 1],
      matchedWordCount: nextProgress.matchedWordCount,
    }
  }

  return findSpokenWordInWindow(lines, words, spokenWords, spokenSet, nextLineStart, 0, lookaheadWords, options, (word) => isReliableSkipWord(word) && matchesScriptWordInRecentTranscript(word, spokenWords))
}

function canRecoverSkippedWords(progress: ReturnType<typeof getVoiceCursorProgress>) {
  return progress.matchedWordCount > 0 && progress.matchedWordCount < progress.wordCount
}

function canAdvancePastLastWord(progress: ReturnType<typeof getVoiceCursorProgress>) {
  return progress.wordCount > 0 && progress.matchedWordCount === progress.wordCount - 1
}

function canAdvanceToNextLine(progress: ReturnType<typeof getVoiceCursorProgress>) {
  return canAdvancePastLastWord(progress) || progress.matchedWordCount >= 2
}

function shouldPreferRecoveryMatch(nearMatch: VoiceCursorMatch, recoveryMatch: VoiceCursorMatch) {
  return !isReliableSkipWord(nearMatch.matchedWord) && isReliableSkipWord(recoveryMatch.matchedWord)
}

function isReliableNextLinePrefix(words: string[], matchedWordCount: number) {
  return matchedWordCount >= 2 || (matchedWordCount === 1 && isReliableSkipWord(words[0]))
}

function isReliableSkipWord(word: string) {
  // Far skips need a stronger anchor than short filler words to avoid accidental jumps.
  return word.length >= 5
}

function getLineBoundedLookahead(words: VoiceWordPosition[], cursor: number, lookaheadWords: number) {
  const currentWord = words[cursor]

  if (!currentWord) {
    return lookaheadWords
  }

  let boundedLookahead = 0

  while (cursor + boundedLookahead < words.length && boundedLookahead < lookaheadWords && words[cursor + boundedLookahead].lineIndex === currentWord.lineIndex) {
    boundedLookahead += 1
  }

  return Math.max(1, boundedLookahead)
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
    if (matchesScriptWordInTranscript(lineWords[index], spokenWords, spokenSet)) {
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
  let transcriptIndex = 0

  while (transcriptIndex < transcriptWords.length) {
    const lineIndex = lineStart + matched

    if (lineIndex >= lineWords.length) {
      break
    }

    const wordMatchLength = getScriptWordMatchLength(lineWords[lineIndex], transcriptWords, transcriptIndex)

    if (wordMatchLength > 0) {
      matched += 1
      transcriptIndex += wordMatchLength
      continue
    }

    if (matchesJoinedLineWords(lineWords, lineIndex, transcriptWords[transcriptIndex])) {
      matched += 2
      transcriptIndex += 1
      continue
    }

    break
  }

  return matched
}

function shouldAdvanceFromLine(progress: ReturnType<typeof getLineVoiceProgress>) {
  return progress.wordCount > 0 && progress.matchedWordCount >= progress.wordCount
}

function countOrderedPrefixMatches(lineWords: string[], transcriptWords: string[], startIndex = 0) {
  let matched = startIndex
  let transcriptIndex = 0

  while (transcriptIndex < transcriptWords.length) {
    if (matched >= lineWords.length) {
      break
    }

    const wordMatchLength = getScriptWordMatchLength(lineWords[matched], transcriptWords, transcriptIndex)

    if (wordMatchLength > 0) {
      matched += 1
      transcriptIndex += wordMatchLength
      continue
    }

    if (matchesJoinedLineWords(lineWords, matched, transcriptWords[transcriptIndex])) {
      matched += 2
      transcriptIndex += 1
      continue
    }

    transcriptIndex += 1
  }

  return matched
}

function countRecentLinePrefixMatches(lineWords: string[], transcriptWords: string[]) {
  let bestMatchCount = 0

  for (let transcriptStart = 0; transcriptStart < transcriptWords.length; transcriptStart += 1) {
    const { consumedWordCount, matchedWordCount } = countLinePrefixMatchFromTranscript(lineWords, transcriptWords, transcriptStart)

    if (matchedWordCount > bestMatchCount && transcriptStart + consumedWordCount >= transcriptWords.length) {
      bestMatchCount = matchedWordCount
    }
  }

  return bestMatchCount
}

function countLinePrefixMatchFromTranscript(lineWords: string[], transcriptWords: string[], transcriptStart: number) {
  let matchedWordCount = 0
  let transcriptIndex = transcriptStart

  while (transcriptIndex < transcriptWords.length && matchedWordCount < lineWords.length) {
    const wordMatchLength = getScriptWordMatchLength(lineWords[matchedWordCount], transcriptWords, transcriptIndex)

    if (wordMatchLength > 0) {
      matchedWordCount += 1
      transcriptIndex += wordMatchLength
      continue
    }

    if (matchesJoinedLineWords(lineWords, matchedWordCount, transcriptWords[transcriptIndex])) {
      matchedWordCount += 2
      transcriptIndex += 1
      continue
    }

    break
  }

  return {
    consumedWordCount: transcriptIndex - transcriptStart,
    matchedWordCount,
  }
}

function getScriptWordMatchLength(scriptWord: string, transcriptWords: string[], transcriptIndex: number) {
  if (scriptWord === transcriptWords[transcriptIndex]) {
    return 1
  }

  return getNumberWordMatchLength(scriptWord, transcriptWords, transcriptIndex)
}

function matchesScriptWordInTranscript(scriptWord: string, transcriptWords: string[], transcriptSet: Set<string>) {
  if (transcriptSet.has(scriptWord)) {
    return true
  }

  for (let index = 0; index < transcriptWords.length; index += 1) {
    if (getNumberWordMatchLength(scriptWord, transcriptWords, index) > 0) {
      return true
    }
  }

  return false
}

function matchesScriptWordInRecentTranscript(scriptWord: string, transcriptWords: string[], recentWordLimit = 4) {
  const recentWords = transcriptWords.slice(-recentWordLimit)
  return matchesScriptWordInTranscript(scriptWord, recentWords, new Set(recentWords))
}

function getNumberWordMatchLength(scriptWord: string, transcriptWords: string[], transcriptIndex: number) {
  const sequences = getNumberWordSequences(scriptWord)

  for (const sequence of sequences) {
    if (sequence.length === 0 || transcriptIndex + sequence.length > transcriptWords.length) {
      continue
    }

    if (sequence.every((word, offset) => word === transcriptWords[transcriptIndex + offset])) {
      return sequence.length
    }
  }

  return 0
}

function getNumberWordSequences(scriptWord: string) {
  if (!/^\d+$/.test(scriptWord)) {
    return []
  }

  const cached = numberWordSequencesCache.get(scriptWord)

  if (cached) {
    return cached
  }

  const sequences: string[][] = [scriptWord.split('').map((digit) => digitWords[Number(digit)])]
  const numberValue = Number(scriptWord)

  if (Number.isSafeInteger(numberValue) && numberValue >= 0 && numberValue <= 999_999 && (scriptWord === '0' || !scriptWord.startsWith('0'))) {
    const cardinalWords = spanishCardinalWords(numberValue)

    if (cardinalWords.length > 0) {
      sequences.push(cardinalWords)

      const withoutAnd = cardinalWords.filter((word) => word !== 'y')

      if (withoutAnd.length !== cardinalWords.length) {
        sequences.push(withoutAnd)
      }
    }
  }

  const uniqueSequences = uniqueWordSequences(sequences)
  numberWordSequencesCache.set(scriptWord, uniqueSequences)

  return uniqueSequences
}

function spanishCardinalWords(value: number): string[] {
  if (value < 10) {
    return [digitWords[value]]
  }

  if (value < 20) {
    return [teenWords[value - 10]]
  }

  if (value < 30) {
    return [twentyWords[value - 20]]
  }

  if (value < 100) {
    const ten = Math.floor(value / 10)
    const unit = value % 10

    return unit === 0 ? [tensWords[ten]] : [tensWords[ten], 'y', digitWords[unit]]
  }

  if (value === 100) {
    return ['cien']
  }

  if (value < 1000) {
    const hundred = Math.floor(value / 100)
    const rest = value % 100

    return rest === 0 ? [hundredWords[hundred]] : [hundredWords[hundred], ...spanishCardinalWords(rest)]
  }

  const thousands = Math.floor(value / 1000)
  const rest = value % 1000
  const thousandWords = thousands === 1 ? ['mil'] : [...spanishCardinalWords(thousands), 'mil']

  return rest === 0 ? thousandWords : [...thousandWords, ...spanishCardinalWords(rest)]
}

function uniqueWordSequences(sequences: string[][]) {
  const seen = new Set<string>()

  return sequences.filter((sequence) => {
    const key = sequence.join(' ')

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
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
