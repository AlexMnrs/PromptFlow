import { describe, expect, it } from 'vitest'
import { estimateMinutes, findVoiceCursorMatch, findVoiceTargetLine, getLineVoiceProgress, getVoiceCursorProgress, normalizeText, splitScript } from './prompter'

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
    const match = findVoiceCursorMatch(lines, 'want to record', 0)

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
})
