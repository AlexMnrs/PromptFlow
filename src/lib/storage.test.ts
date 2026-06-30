import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../data/defaults'
import type { AppState, ScriptItem } from '../types'
import { loadState, saveState } from './storage'

const storageKey = 'promptflow.app-state.v1'

beforeEach(() => {
  const store = new Map<string, string>()

  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  })
})

describe('loadState', () => {
  it('falls back safely when saved JSON is malformed', () => {
    localStorage.setItem(storageKey, '{not valid json')

    const state = loadState()

    expect(state.scripts).toHaveLength(1)
    expect(state.scripts[0].title).toBe('Guion de bienvenida')
    expect(state.settings).toEqual(defaultSettings)
  })

  it('preserves valid scripts and fills missing settings from defaults', () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        scripts: [scriptFixture({ id: 'kept-script', title: 'Kept script', body: 'Saved text' })],
        selectedScriptId: 'kept-script',
      }),
    )

    const state = loadState()

    expect(state.scripts).toHaveLength(1)
    expect(state.scripts[0].title).toBe('Kept script')
    expect(state.scripts[0].body).toBe('Saved text')
    expect(state.selectedScriptId).toBe('kept-script')
    expect(state.settings).toEqual(defaultSettings)
  })

  it('fills missing script fields without dropping recoverable script bodies', () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        scripts: [{ body: 'Recovered body', lastPosition: -4 }],
        selectedScriptId: 'missing-id',
        settings: { language: 'fr-FR', speed: 1.4 },
      }),
    )

    const state = loadState()

    expect(state.scripts).toHaveLength(1)
    expect(state.scripts[0].title).toBe('Recovered script')
    expect(state.scripts[0].body).toBe('Recovered body')
    expect(state.scripts[0].lastPosition).toBe(0)
    expect(state.selectedScriptId).toBe(state.scripts[0].id)
    expect(state.settings.language).toBe('fr-FR')
    expect(state.settings.speed).toBe(1.4)
    expect(state.settings.layout).toBe(defaultSettings.layout)
  })

  it('drops unrecoverable script entries and keeps valid ones', () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        scripts: [{ title: 'Missing body' }, scriptFixture({ id: 'valid', title: 'Valid', body: 'Still here' })],
        selectedScriptId: 'missing',
        settings: { layout: 'invalid', mirror: false, overlayOpacity: 2 },
      }),
    )

    const state = loadState()

    expect(state.scripts).toHaveLength(1)
    expect(state.scripts[0].id).toBe('valid')
    expect(state.selectedScriptId).toBe('valid')
    expect(state.settings.layout).toBe(defaultSettings.layout)
    expect(state.settings.mirror).toBe(false)
    expect(state.settings.overlayOpacity).toBe(defaultSettings.overlayOpacity)
  })

  it('migrates old seed scripts to the current Spanish default while preserving the script id', () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        scripts: [
          scriptFixture({
            id: 'legacy',
            title: 'Guion de bienvenida',
            body: 'Hola. Hoy quiero grabar una pieza clara para probar la app.',
          }),
        ],
        selectedScriptId: 'legacy',
        settings: { ...defaultSettings, language: 'es-ES' },
      }),
    )

    const state = loadState()

    expect(state.scripts[0].id).toBe('legacy')
    expect(state.scripts[0].title).toBe('Guion de bienvenida')
    expect(state.scripts[0].body).toContain('Hoy quiero grabar')
    expect(state.settings.language).toBe(defaultSettings.language)
  })

  it('migrates the old English default seed to Spanish defaults', () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        scripts: [
          scriptFixture({
            id: 'legacy-english',
            title: 'Welcome script',
            body: 'Hi. Today I want to record a clear, direct take without losing the thread.',
          }),
        ],
        selectedScriptId: 'legacy-english',
        settings: { ...defaultSettings, language: 'en-US' },
      }),
    )

    const state = loadState()

    expect(state.scripts[0].id).toBe('legacy-english')
    expect(state.scripts[0].title).toBe('Guion de bienvenida')
    expect(state.scripts[0].body).toContain('Hoy quiero grabar')
    expect(state.settings.language).toBe('es-ES')
  })

  it('round-trips valid saved state', () => {
    const state: AppState = {
      scripts: [scriptFixture({ id: 'round-trip', title: 'Round trip', body: 'Persisted' })],
      selectedScriptId: 'round-trip',
      settings: { ...defaultSettings, theme: 'contrast', voiceFollow: false },
    }

    saveState(state)

    expect(loadState()).toEqual(state)
  })
})

function scriptFixture(patch: Partial<ScriptItem> = {}): ScriptItem {
  return {
    id: 'script-id',
    title: 'Script title',
    body: 'Script body',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastPosition: 0,
    ...patch,
  }
}
