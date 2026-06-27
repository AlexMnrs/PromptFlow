import type { AppState, PrompterSettings, ScriptItem } from '../types'

const sampleBody = `Hola. Hoy quiero grabar una pieza clara, directa y sin perder el hilo.

La idea principal aparece al principio, porque la audiencia decide muy rapido si se queda.

Cuando el texto avanza con mi voz, puedo mirar mas a camara y menos a la pantalla.

Si necesito improvisar, pauso un momento, vuelvo a la linea activa y sigo sin romper la toma.

Al final cierro con una frase breve, una accion concreta y una pausa natural.`

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

export function createScript(title = 'Nuevo guion', body = ''): ScriptItem {
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
