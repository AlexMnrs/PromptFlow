export type AppView = 'library' | 'editor' | 'prompter'

export type PrompterLayout = 'overlay' | 'split'

export type SplitOrder = 'script-first' | 'camera-first'

export type ThemeMode = 'dark' | 'light' | 'contrast'

export type SaveStatus = 'Guardado' | 'Guardando' | 'Error'

export interface ScriptItem {
  id: string
  title: string
  body: string
  createdAt: string
  updatedAt: string
  lastPosition: number
}

export interface PrompterSettings {
  layout: PrompterLayout
  splitOrder: SplitOrder
  mirror: boolean
  zoom: number
  fontSize: number
  lineHeight: number
  textWidth: number
  speed: number
  theme: ThemeMode
  language: string
  overlayOpacity: number
  voiceFollow: boolean
  voiceCommands: boolean
}

export interface AppState {
  scripts: ScriptItem[]
  selectedScriptId: string
  settings: PrompterSettings
}
