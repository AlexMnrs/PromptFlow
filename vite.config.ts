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
    __APP_BUILD_INFO__: JSON.stringify(appVersion.buildInfo),
    __APP_VERSION__: JSON.stringify(appVersion.displayVersion),
  },
  plugins: [react()],
})

function buildAppVersion(packageVersion: string) {
  const buildNumber = process.env.GITHUB_RUN_NUMBER ?? git('rev-list --count HEAD')
  const commitSha = process.env.GITHUB_SHA?.slice(0, 7) ?? git('rev-parse --short HEAD')
  const isDirty = !process.env.GITHUB_ACTIONS && isWorkingTreeDirty()
  const buildInfo = [
    `version ${packageVersion}`,
    buildNumber ? `build ${buildNumber}` : null,
    commitSha ? `commit ${commitSha}` : null,
    isDirty ? 'local changes' : null,
  ].filter(Boolean).join(' | ')

  return {
    buildInfo,
    displayVersion: formatDisplayVersion(packageVersion, buildNumber, isDirty),
  }
}

function formatDisplayVersion(packageVersion: string, buildNumber: string | null, isDirty: boolean) {
  const [major = '0', minor = '0', patch = '0'] = packageVersion.split('.')
  const visiblePatch = buildNumber && /^\d+$/.test(buildNumber) ? buildNumber : patch

  return `${major}.${minor}.${visiblePatch}${isDirty ? '-dev' : ''}`
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
