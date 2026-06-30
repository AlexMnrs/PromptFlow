import type { AppState, PrompterSettings, ScriptItem } from '../types'

const sampleBody = `Hola. Hoy quiero grabar una toma clara y directa sin perder el hilo.

La idea principal aparece al principio, porque la audiencia decide rapido si quiere seguir mirando.

Cuando el texto sigue mi voz, puedo mirar mas a la camara y menos a la pantalla.

Si necesito improvisar, hago una pausa, vuelvo a la frase activa y continuo sin romper la toma.

Al final, cierro con una frase corta, una accion clara y una pausa natural.`

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
  language: 'es-ES',
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
  const seedScript = createScript('Guion de bienvenida', sampleBody)

  return {
    scripts: [seedScript],
    selectedScriptId: seedScript.id,
    settings: defaultSettings,
  }
}
