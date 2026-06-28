import type { AppState, PrompterSettings, ScriptItem } from '../types'

const sampleBody = `Hi. Today I want to record a clear, direct take without losing the thread.

The main idea appears at the beginning, because the audience decides quickly whether to keep watching.

When the text follows my voice, I can look more at the camera and less at the screen.

If I need to improvise, I pause for a moment, return to the active line, and continue without breaking the take.

At the end, I close with a short sentence, a clear action, and a natural pause.`

export const defaultSettings: PrompterSettings = {
  layout: 'overlay',
  splitOrder: 'script-first',
  mirror: true,
  zoom: 1,
  fontSize: 34,
  lineHeight: 1.38,
  textWidth: 82,
  speed: 1,
  theme: 'dark',
  language: 'en-US',
  overlayOpacity: 0.44,
  voiceFollow: true,
  voiceCommands: true,
  cameraFacing: 'user',
}

export function createId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createScript(title = 'New script', body = ''): ScriptItem {
  const now = new Date().toISOString()

  return {
    id: createId(),
    title,
    body,
    createdAt: now,
    updatedAt: now,
    lastPosition: 0,
  }
}

export function createDefaultState(): AppState {
  const seedScript = createScript('Welcome script', sampleBody)

  return {
    scripts: [seedScript],
    selectedScriptId: seedScript.id,
    settings: defaultSettings,
  }
}
