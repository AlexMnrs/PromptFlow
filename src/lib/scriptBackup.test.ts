import { describe, expect, it } from 'vitest'
import type { ScriptItem } from '../types'
import { createScriptBackup, parseScriptBackup } from './scriptBackup'

describe('createScriptBackup', () => {
  it('exports script metadata without reusing the script id', () => {
    const backup = JSON.parse(createScriptBackup(scriptFixture())) as Record<string, unknown>

    expect(backup.version).toBe(1)
    expect(backup.script).toEqual({
      title: 'Backup title',
      body: 'Backup body',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      lastPosition: 2,
    })
  })
})

describe('parseScriptBackup', () => {
  it('imports a valid backup and assigns a fresh id', () => {
    const imported = parseScriptBackup(createScriptBackup(scriptFixture()))

    expect(imported.id).not.toBe('original-id')
    expect(imported.title).toBe('Backup title')
    expect(imported.body).toBe('Backup body')
    expect(imported.createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(imported.updatedAt).toBe('2026-01-02T00:00:00.000Z')
    expect(imported.lastPosition).toBe(2)
  })

  it('rejects malformed JSON with a helpful message', () => {
    expect(() => parseScriptBackup('{broken json')).toThrow('could not be parsed')
  })

  it('rejects JSON that is not a PromptFlow backup', () => {
    expect(() => parseScriptBackup(JSON.stringify({ title: 'Plain object' }))).toThrow('not a valid PromptFlow backup')
  })

  it('rejects backups without a script body', () => {
    expect(() => parseScriptBackup(JSON.stringify({ version: 1, script: { title: 'Missing body' } }))).toThrow('missing a script title or body')
  })

  it('normalizes invalid lastPosition while preserving recoverable fields', () => {
    const imported = parseScriptBackup(
      JSON.stringify({
        version: 1,
        script: {
          title: 'Partial backup',
          body: 'Still useful',
          lastPosition: -8,
        },
      }),
    )

    expect(imported.title).toBe('Partial backup')
    expect(imported.body).toBe('Still useful')
    expect(imported.lastPosition).toBe(0)
  })
})

function scriptFixture(): ScriptItem {
  return {
    id: 'original-id',
    title: 'Backup title',
    body: 'Backup body',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    lastPosition: 2,
  }
}
