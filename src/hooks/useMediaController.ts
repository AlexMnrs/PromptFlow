import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

export type MediaPermission = 'idle' | 'requesting' | 'ready' | 'partial' | 'blocked' | 'unsupported'

export interface MediaController {
  stream: MediaStream | null
  permission: MediaPermission
  error: string
  hasCamera: boolean
  hasMic: boolean
  requestMedia: () => Promise<MediaStream | null>
  stopMedia: () => void
}

const cameraConstraints: MediaStreamConstraints = {
  video: {
    facingMode: 'user',
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
}

export function useMediaController(videoRef: RefObject<HTMLVideoElement | null>): MediaController {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [permission, setPermission] = useState<MediaPermission>('idle')
  const [error, setError] = useState('')
  const [hasCamera, setHasCamera] = useState(false)
  const [hasMic, setHasMic] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)

  const assignStream = useCallback((nextStream: MediaStream | null, nextPermission: MediaPermission) => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = nextStream
    setStream(nextStream)
    setPermission(nextPermission)
    setHasCamera(Boolean(nextStream?.getVideoTracks().length))
    setHasMic(Boolean(nextStream?.getAudioTracks().length))
  }, [])

  const requestMedia = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission('unsupported')
      setError('Este navegador no permite acceder a camara y microfono desde la web.')
      return null
    }

    setPermission('requesting')
    setError('')

    try {
      const media = await navigator.mediaDevices.getUserMedia(cameraConstraints)
      assignStream(media, 'ready')
      return media
    } catch (combinedError) {
      try {
        const media = await navigator.mediaDevices.getUserMedia({ video: cameraConstraints.video })
        assignStream(media, 'partial')
        setError('Camara activa. El microfono no esta disponible para esta sesion.')
        return media
      } catch {
        try {
          const media = await navigator.mediaDevices.getUserMedia({ audio: cameraConstraints.audio })
          assignStream(media, 'partial')
          setError('Microfono activo. La camara no esta disponible para esta sesion.')
          return media
        } catch {
          assignStream(null, 'blocked')
          setError(combinedError instanceof Error ? combinedError.message : 'Permiso denegado o dispositivo no disponible.')
          return null
        }
      }
    }
  }, [assignStream])

  const stopMedia = useCallback(() => {
    assignStream(null, 'idle')
    setError('')
  }, [assignStream])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream, videoRef])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  return {
    stream,
    permission,
    error,
    hasCamera,
    hasMic,
    requestMedia,
    stopMedia,
  }
}
