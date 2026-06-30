import { createDefaultState, defaultSettings } from '../data/defaults'
import type { AppState, CameraFacing, PrompterLayout, PrompterSettings, ScriptItem, SplitOrder, ThemeMode } from '../types'

const storageKey = 'promptflow.app-state.v1'
const legacySpanishSeedTitle = 'Guion de bienvenida'
const legacySpanishSeedStart = 'Hola. Hoy quiero grabar una pieza clara'
const legacyEnglishSeedTitle = 'Welcome script'
const legacyEnglishSeedStart = 'Hi. Today I want to record'

export function loadState(): AppState {
  try {
    const stored = localStorage.getItem(storageKey)

    if (!stored) {
      return createDefaultState()
    }

    return migrateState(normalizeState(JSON.parse(stored)))
  } catch {
    return createDefaultState()
  }
}

export function saveState(state: AppState) {
  localStorage.setItem(storageKey, JSON.stringify(state))
}

function normalizeState(value: unknown): AppState {
  if (!isRecord(value)) {
    return createDefaultState()
  }

  const defaultState = createDefaultState()
  const scripts = normalizeScripts(value.scripts)

  if (scripts.length === 0) {
    return defaultState
  }

  const selectedScriptId =
    typeof value.selectedScriptId === 'string' && scripts.some((script) => script.id === value.selectedScriptId) ? value.selectedScriptId : scripts[0].id

  return {
    scripts,
    selectedScriptId,
    settings: normalizeSettings(value.settings),
  }
}

function normalizeScripts(value: unknown): ScriptItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((script) => {
    if (!isRecord(script) || typeof script.body !== 'string') {
      return []
    }

    const now = new Date().toISOString()
    const id = typeof script.id === 'string' && script.id.trim() ? script.id : createStorageId()
    const title = typeof script.title === 'string' ? script.title : 'Recovered script'
    const createdAt = typeof script.createdAt === 'string' ? script.createdAt : now
    const updatedAt = typeof script.updatedAt === 'string' ? script.updatedAt : createdAt
    const lastPosition = typeof script.lastPosition === 'number' && Number.isFinite(script.lastPosition) ? Math.max(0, Math.floor(script.lastPosition)) : 0

    return [
      {
        id,
        title,
        body: script.body,
        createdAt,
        updatedAt,
        lastPosition,
      },
    ]
  })
}

function normalizeSettings(value: unknown): PrompterSettings {
  if (!isRecord(value)) {
    return defaultSettings
  }

  return {
    layout: oneOf(value.layout, ['overlay', 'split'], defaultSettings.layout),
    splitOrder: oneOf(value.splitOrder, ['script-first', 'camera-first'], defaultSettings.splitOrder),
    mirror: typeof value.mirror === 'boolean' ? value.mirror : defaultSettings.mirror,
    zoom: positiveNumber(value.zoom, defaultSettings.zoom),
    fontSize: positiveNumber(value.fontSize, defaultSettings.fontSize),
    lineHeight: positiveNumber(value.lineHeight, defaultSettings.lineHeight),
    textWidth: positiveNumber(value.textWidth, defaultSettings.textWidth),
    speed: positiveNumber(value.speed, defaultSettings.speed),
    theme: oneOf(value.theme, ['dark', 'light', 'contrast'], defaultSettings.theme),
    language: typeof value.language === 'string' && value.language.trim() ? value.language : defaultSettings.language,
    overlayOpacity: boundedNumber(value.overlayOpacity, 0, 1, defaultSettings.overlayOpacity),
    voiceFollow: typeof value.voiceFollow === 'boolean' ? value.voiceFollow : defaultSettings.voiceFollow,
    voiceCommands: typeof value.voiceCommands === 'boolean' ? value.voiceCommands : defaultSettings.voiceCommands,
    cameraFacing: oneOf(value.cameraFacing, ['user', 'environment'], defaultSettings.cameraFacing),
  }
}

function migrateState(state: AppState): AppState {
  const defaultState = createDefaultState()
  const defaultScript = defaultState.scripts[0]
  const hasOnlyLegacySeed =
    state.scripts.length === 1 &&
    ((state.scripts[0]?.title === legacySpanishSeedTitle && state.scripts[0]?.body.startsWith(legacySpanishSeedStart)) ||
      (state.scripts[0]?.title === legacyEnglishSeedTitle && state.scripts[0]?.body.startsWith(legacyEnglishSeedStart)))

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function oneOf<T extends PrompterLayout | SplitOrder | ThemeMode | CameraFacing>(value: unknown, allowed: readonly T[], fallback: T) {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback
}

function positiveNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function boundedNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback
}

function createStorageId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
