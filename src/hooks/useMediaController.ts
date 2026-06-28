import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { CameraFacing } from '../types'

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

function createMediaConstraints(facingMode: CameraFacing): MediaStreamConstraints {
  return {
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  }
}

export function useMediaController(videoRef: RefObject<HTMLVideoElement | null>, facingMode: CameraFacing): MediaController {
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
      setError('This browser does not allow camera and microphone access from the web.')
      return null
    }

    setPermission('requesting')
    setError('')
    const mediaConstraints = createMediaConstraints(facingMode)

    try {
      const media = await navigator.mediaDevices.getUserMedia(mediaConstraints)
      assignStream(media, 'ready')
      return media
    } catch (combinedError) {
      try {
        const media = await navigator.mediaDevices.getUserMedia({ video: mediaConstraints.video })
        assignStream(media, 'partial')
        setError('Camera is active. The microphone is not available for this session.')
        return media
      } catch {
        try {
          const media = await navigator.mediaDevices.getUserMedia({ audio: mediaConstraints.audio })
          assignStream(media, 'partial')
          setError('Microphone is active. The camera is not available for this session.')
          return media
        } catch {
          assignStream(null, 'blocked')
          setError(combinedError instanceof Error ? combinedError.message : 'Permiso denegado o dispositivo no disponible.')
          return null
        }
      }
    }
  }, [assignStream, facingMode])

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
