import { useEffect, useState } from 'react'

type WakeLockStatus = 'idle' | 'active' | 'unsupported' | 'blocked'

export function useWakeLock(enabled: boolean) {
  const [status, setStatus] = useState<WakeLockStatus>('idle')

  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    async function requestLock() {
      if (!enabled) {
        setStatus('idle')
        return
      }

      if (!navigator.wakeLock?.request) {
        setStatus('unsupported')
        return
      }

      try {
        sentinel = await navigator.wakeLock.request('screen')

        if (cancelled) {
          await sentinel.release()
          return
        }

        setStatus('active')
        sentinel.addEventListener('release', () => {
          if (!cancelled) {
            setStatus('idle')
          }
        })
      } catch {
        setStatus('blocked')
      }
    }

    requestLock()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        requestLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      sentinel?.release().catch(() => undefined)
    }
  }, [enabled])

  return status
}
