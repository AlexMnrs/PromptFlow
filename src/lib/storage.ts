import { createDefaultState } from '../data/defaults'
import type { AppState } from '../types'

const storageKey = 'promptflow.app-state.v1'

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

    return parsed
  } catch {
    return createDefaultState()
  }
}

export function saveState(state: AppState) {
  localStorage.setItem(storageKey, JSON.stringify(state))
}
