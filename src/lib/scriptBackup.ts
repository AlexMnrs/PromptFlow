import { createId } from '../data/defaults'
import type { ScriptItem } from '../types'

const backupVersion = 1

interface ScriptBackup {
  version: number
  script: Omit<ScriptItem, 'id'>
}

export function createScriptBackup(script: ScriptItem) {
  const backup: ScriptBackup = {
    version: backupVersion,
    script: {
      title: script.title,
      body: script.body,
      createdAt: script.createdAt,
      updatedAt: script.updatedAt,
      lastPosition: script.lastPosition,
    },
  }

  return `${JSON.stringify(backup, null, 2)}\n`
}

export function parseScriptBackup(value: string): ScriptItem {
  let parsed: unknown

  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error('The selected JSON file could not be parsed.')
  }

  if (!isRecord(parsed) || parsed.version !== backupVersion || !isRecord(parsed.script)) {
    throw new Error('The selected JSON file is not a valid PromptFlow backup.')
  }

  const { script } = parsed

  if (typeof script.title !== 'string' || typeof script.body !== 'string') {
    throw new Error('The selected JSON backup is missing a script title or body.')
  }

  const now = new Date().toISOString()

  return {
    id: createId(),
    title: script.title,
    body: script.body,
    createdAt: typeof script.createdAt === 'string' ? script.createdAt : now,
    updatedAt: typeof script.updatedAt === 'string' ? script.updatedAt : now,
    lastPosition: typeof script.lastPosition === 'number' && Number.isFinite(script.lastPosition) ? Math.max(0, Math.floor(script.lastPosition)) : 0,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
