import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const appVersion = buildAppVersion(packageJson.version)

// https://vite.dev/config/
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react()],
})

function buildAppVersion(packageVersion: string) {
  const buildNumber = process.env.GITHUB_RUN_NUMBER ?? git('rev-list --count HEAD') ?? 'local'
  const commitSha = process.env.GITHUB_SHA?.slice(0, 7) ?? git('rev-parse --short HEAD')
  const dirtySuffix = process.env.GITHUB_ACTIONS || !isWorkingTreeDirty() ? '' : '.dirty'

  return `${packageVersion}+${buildNumber}${commitSha ? `.${commitSha}` : ''}${dirtySuffix}`
}

function git(command: string) {
  try {
    return execSync(`git ${command}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return null
  }
}

function isWorkingTreeDirty() {
  try {
    execSync('git diff --quiet HEAD --', { stdio: 'ignore' })
    return false
  } catch {
    return true
  }
}
