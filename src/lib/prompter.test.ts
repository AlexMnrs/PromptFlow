import { describe, expect, it } from 'vitest'
import { estimateMinutes, findVoiceCursorMatch, findVoiceTargetLine, getLineVoiceProgress, getVoiceCursorForLine, getVoiceCursorProgress, normalizeText, splitScript } from './prompter'

describe('splitScript', () => {
  it('splits scripts on punctuation and line breaks', () => {
    expect(splitScript('Intro line. Second idea!\nThird question?')).toEqual(['Intro line.', 'Second idea!', 'Third question?'])
  })

  it('returns a helpful placeholder for empty scripts', () => {
    expect(splitScript('   \n  ')).toEqual(['Write or import a script to get started.'])
  })
})

describe('normalizeText', () => {
  it('normalizes casing, punctuation, whitespace, and accented characters', () => {
    expect(normalizeText('  Canción rápida: ¿mañana?  ')).toBe('cancion rapida manana')
  })
})

describe('estimateMinutes', () => {
  it('keeps very short or empty scripts at a one-minute minimum', () => {
    expect(estimateMinutes('', 1)).toBe(1)
    expect(estimateMinutes('short script', 1)).toBe(1)
  })

  it('uses reading speed to estimate longer scripts', () => {
    const body = Array.from({ length: 300 }, (_, index) => `word${index}`).join(' ')

    expect(estimateMinutes(body, 1)).toBe(3)
    expect(estimateMinutes(body, 2)).toBe(2)
  })
})

describe('voice progress helpers', () => {
  it('tracks basic ordered voice progress within a line', () => {
    const progress = getLineVoiceProgress('Today I want to record clearly', 'today I want')

    expect(progress.wordCount).toBe(6)
    expect(progress.matchedWordCount).toBe(3)
    expect(progress.coverage).toBe(0.5)
    expect([...progress.matchedIndexes]).toEqual([0, 1, 2])
  })

  it('handles punctuation and accented words while matching speech', () => {
    const progress = getLineVoiceProgress('Canción rápida para mañana.', 'cancion rapida')

    expect(progress.matchedWordCount).toBe(2)
    expect(progress.wordCount).toBe(4)
  })

  it('advances to the next line after the current line is fully matched', () => {
    const lines = ['First clear sentence', 'Second clear sentence']
    const currentProgress = getLineVoiceProgress(lines[0], 'first clear sentence')

    expect(findVoiceTargetLine(lines, 'first clear sentence', 0, currentProgress.matchedWordCount)).toBe(1)
  })

  it('keeps the current line when speech is too short to identify a new target', () => {
    const lines = ['First clear sentence', 'Second clear sentence']

    expect(findVoiceTargetLine(lines, 'clear', 0)).toBe(0)
  })

  it('advances to the nearest spoken word in a small lookahead window', () => {
    const lines = ['Today I want to record clearly']
    const match = findVoiceCursorMatch(lines, 'want', 0)

    expect(match.matched).toBe(true)
    expect(match.cursorWordIndex).toBe(3)
    expect(match.lineIndex).toBe(0)
    expect(match.matchedWordCount).toBe(3)
  })

  it('moves the cursor across visual lines while preserving local word progress', () => {
    const lines = ['First clear sentence', 'Second clear sentence']
    const match = findVoiceCursorMatch(lines, 'second clear', 3)
    const progress = getVoiceCursorProgress(lines, match.cursorWordIndex)

    expect(match.matched).toBe(true)
    expect(progress.lineIndex).toBe(1)
    expect(progress.matchedWordCount).toBe(1)
  })

  it('follows VoicePrompter by advancing to the nearest matching word only', () => {
    const lines = ['Today I want to record clearly']
    const match = findVoiceCursorMatch(lines, 'Today I want to record', 0, { lookaheadWords: 5, spokenWordLimit: 5 })

    expect(match.matched).toBe(true)
    expect(match.cursorWordIndex).toBe(1)
    expect(match.lineIndex).toBe(0)
    expect(match.matchedWordCount).toBe(1)
  })

  it('can progress through repeated speech results without jumping ahead', () => {
    const lines = ['Today I want to record clearly']
    let cursor = 0
    let lastMatchedWord = ''

    for (let step = 0; step < 5; step += 1) {
      const match = findVoiceCursorMatch(lines, 'Today I want to record', cursor, { lastMatchedWord, lookaheadWords: 5, spokenWordLimit: 5 })
      expect(match.matched).toBe(true)
      cursor = match.cursorWordIndex
      lastMatchedWord = match.matchedWord
    }

    expect(cursor).toBe(5)
    expect(getVoiceCursorProgress(lines, cursor).matchedWordCount).toBe(5)
  })

  it('does not jump paragraphs when spoken words are outside the small lookahead window', () => {
    const lines = ['Today I want to record clearly']
    const match = findVoiceCursorMatch(lines, 'clearly', 0, { lookaheadWords: 5, spokenWordLimit: 5 })

    expect(match.matched).toBe(false)
    expect(match.cursorWordIndex).toBe(0)
  })

  it('recovers within the current sentence when the reader skips words and resumes later', () => {
    const lines = ['hola me llamo pepito y soy vendedor ambulante local de fruta']
    const match = findVoiceCursorMatch(lines, 'aqui divago un poco y opino fruta', 4, {
      lookaheadWords: 5,
      recoveryLookaheadWords: 12,
      spokenWordLimit: 5,
    })

    expect(match.matched).toBe(true)
    expect(match.cursorWordIndex).toBe(11)
    expect(match.lineIndex).toBe(0)
    expect(match.matchedWordCount).toBe(11)
  })

  it('does not use short filler words for long skip recovery', () => {
    const lines = ['hola me llamo pepito y soy vendedor ambulante local de fruta']
    const match = findVoiceCursorMatch(lines, 'hablo un poco de', 4, {
      lookaheadWords: 5,
      recoveryLookaheadWords: 12,
      spokenWordLimit: 5,
    })

    expect(match.matched).toBe(false)
    expect(match.cursorWordIndex).toBe(4)
  })

  it('does not jump into the next sentence before the current sentence is complete', () => {
    const lines = ['Hoy termino esta frase', 'Siguiente parrafo empieza aqui']
    const match = findVoiceCursorMatch(lines, 'siguiente parrafo', 2, { lookaheadWords: 5, spokenWordLimit: 5 })

    expect(match.matched).toBe(false)
    expect(match.cursorWordIndex).toBe(2)
    expect(match.lineIndex).toBe(0)
  })

  it('can enter the next sentence once the cursor is already there', () => {
    const lines = ['Hoy termino esta frase', 'Siguiente parrafo empieza aqui']
    const nextLineCursor = getVoiceCursorForLine(lines, 1)
    const match = findVoiceCursorMatch(lines, 'siguiente parrafo', nextLineCursor, { lookaheadWords: 5, spokenWordLimit: 5 })

    expect(match.matched).toBe(true)
    expect(match.cursorWordIndex).toBe(nextLineCursor + 1)
    expect(match.lineIndex).toBe(1)
  })

  it('does not reuse unrelated previous line words to skip to a different paragraph', () => {
    const lines = ['Hoy digo la siguiente parte', 'Ahora empieza otra idea']
    const match = findVoiceCursorMatch(lines, 'la siguiente parte', 5, { lookaheadWords: 5, spokenWordLimit: 5 })

    expect(match.matched).toBe(false)
    expect(match.cursorWordIndex).toBe(5)
  })
})
