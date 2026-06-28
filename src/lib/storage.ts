import { createDefaultState, defaultSettings } from '../data/defaults'
import type { AppState } from '../types'

const storageKey = 'promptflow.app-state.v1'
const legacySpanishSeedTitle = 'Guion de bienvenida'
const legacySpanishSeedStart = 'Hola. Hoy quiero grabar una pieza clara'

export function loadState(): AppState {
  try {
    const stored = localStorage.getItem(storageKey)

    if (!stored) {
      return createDefaultState()
    }

    const parsed = JSON.parse(stored) as AppState

    if (!Array.isArray(parsed.scripts) || parsed.scripts.length === 0 || !parsed.settings) {
      return createDefaultState()
    }

    return migrateState(parsed)
  } catch {
    return createDefaultState()
  }
}

export function saveState(state: AppState) {
  localStorage.setItem(storageKey, JSON.stringify(state))
}

function migrateState(state: AppState): AppState {
  const defaultState = createDefaultState()
  const defaultScript = defaultState.scripts[0]
  const hasOnlyLegacySeed =
    state.scripts.length === 1 &&
    state.scripts[0]?.title === legacySpanishSeedTitle &&
    state.scripts[0]?.body.startsWith(legacySpanishSeedStart)

  if (!hasOnlyLegacySeed) {
    return state
  }

  return {
    ...state,
    scripts: [
      {
        ...state.scripts[0],
        title: defaultScript.title,
        body: defaultScript.body,
      },
    ],
    selectedScriptId: state.scripts[0].id,
    settings: {
      ...state.settings,
      language: defaultSettings.language,
    },
  }
}
