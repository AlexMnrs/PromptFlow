import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  Camera,
  CameraOff,
  Check,
  CircleDot,
  Copy,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  Import,
  Languages,
  Library,
  MonitorUp,
  Mic,
  MicOff,
  Minus,
  Moon,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  Save,
  Settings,
  Share2,
  SlidersHorizontal,
  Square,
  Sun,
  SwitchCamera,
  Trash2,
  Type,
  Upload,
  Video,
  VideoOff,
  Wand2,
  X,
  ZoomIn,
} from 'lucide-react'
import './App.css'
import { IconButton } from './components/IconButton'
import { createScript, defaultSettings } from './data/defaults'
import { useMediaController } from './hooks/useMediaController'
import { useSpeechFollower } from './hooks/useSpeechFollower'
import { useWakeLock } from './hooks/useWakeLock'
import { clamp, estimateMinutes, fileNameForScript, formatDuration, getLineVoiceProgress, splitScript } from './lib/prompter'
import { loadState, saveState } from './lib/storage'
import type { AppState, AppView, PrompterSettings, SaveStatus, ScriptItem } from './types'

function App() {
  const [appState, setAppState] = useState<AppState>(() => loadState())
  const [view, setView] = useState<AppView>('library')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('Saved')
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const isAndroid = useMemo(() => isAndroidBrowser(), [])
  const selectedScript = useMemo(
    () => appState.scripts.find((script) => script.id === appState.selectedScriptId) ?? appState.scripts[0],
    [appState.scripts, appState.selectedScriptId],
  )

  useEffect(() => {
    try {
      setSaveStatus('Saving')
      saveState(appState)
      const timer = window.setTimeout(() => setSaveStatus('Saved'), 220)
      return () => window.clearTimeout(timer)
    } catch {
      setSaveStatus('Error')
      return undefined
    }
  }, [appState])

  const updateSelectedScript = useCallback((patch: Partial<ScriptItem>) => {
    setAppState((current) => ({
      ...current,
      scripts: current.scripts.map((script) =>
        script.id === current.selectedScriptId
          ? {
              ...script,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : script,
      ),
    }))
  }, [])

  const updateSettings = useCallback((patch: Partial<PrompterSettings>) => {
    setAppState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        ...patch,
      },
    }))
  }, [])

  const selectScript = useCallback((id: string, nextView: AppView) => {
    setAppState((current) => ({
      ...current,
      selectedScriptId: id,
    }))
    setView(nextView)
  }, [])

  const createNewScript = useCallback(() => {
    const script = createScript()
    setAppState((current) => ({
      ...current,
      scripts: [script, ...current.scripts],
      selectedScriptId: script.id,
    }))
    setView('editor')
  }, [])

  const duplicateScript = useCallback(() => {
    if (!selectedScript) {
      return
    }

    const script = createScript(`${selectedScript.title} copy`, selectedScript.body)
    setAppState((current) => ({
      ...current,
      scripts: [script, ...current.scripts],
      selectedScriptId: script.id,
    }))
    setView('editor')
  }, [selectedScript])

  const deleteSelectedScript = useCallback(() => {
    if (!selectedScript || !window.confirm(`Delete "${selectedScript.title}"?`)) {
      return
    }

    setAppState((current) => {
      const remaining = current.scripts.filter((script) => script.id !== selectedScript.id)
      const fallback = remaining[0] ?? createScript()

      return {
        ...current,
        scripts: remaining.length > 0 ? remaining : [fallback],
        selectedScriptId: fallback.id,
      }
    })
    setView('library')
  }, [selectedScript])

  const exportSelectedScript = useCallback(() => {
    if (!selectedScript) {
      return
    }

    downloadBlob(new Blob([selectedScript.body], { type: 'text/plain;charset=utf-8' }), fileNameForScript(selectedScript, 'txt'))
  }, [selectedScript])

  const handleImportFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    const text = await file.text()
    const title = file.name.replace(/\.[^.]+$/, '') || 'Imported script'
    const script = createScript(title, text.trim())

    setAppState((current) => ({
      ...current,
      scripts: [script, ...current.scripts],
      selectedScriptId: script.id,
    }))
    setView('editor')
  }, [])

  if (!selectedScript) {
    return null
  }

  return (
    <main className={`app-shell theme-${appState.settings.theme} view-${view}`}>
      <input ref={importInputRef} className="visually-hidden" type="file" accept=".txt,.md,text/plain,text/markdown" onChange={handleImportFile} />

      <aside className="library-rail" aria-label="Script library">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            PF
          </div>
          <div>
            <p className="eyebrow">PromptFlow</p>
            <h1>Mobile prompter</h1>
          </div>
        </div>

        <div className="rail-actions">
          <button className="primary-action" type="button" onClick={createNewScript}>
            <Plus aria-hidden="true" size={18} />
            New
          </button>
          <button className="secondary-action" type="button" onClick={() => importInputRef.current?.click()}>
            <Import aria-hidden="true" size={18} />
            Import
          </button>
        </div>

        <ScriptList scripts={appState.scripts} selectedId={selectedScript.id} onSelect={(id) => selectScript(id, 'editor')} />

        <div className="rail-status" role="status" aria-live="polite">
          <Save aria-hidden="true" size={16} />
          <span>{saveStatus}</span>
        </div>
      </aside>

      <section className="workspace" aria-label="Workspace">
        {view === 'library' && (
          <LibraryPanel
            scripts={appState.scripts}
            selectedScript={selectedScript}
            showAndroidWarning={isAndroid}
            onCreate={createNewScript}
            onImport={() => importInputRef.current?.click()}
            onOpen={(id) => selectScript(id, 'editor')}
            onPrompt={(id) => selectScript(id, 'prompter')}
          />
        )}

        {view === 'editor' && (
          <EditorPanel
            script={selectedScript}
            settings={appState.settings}
            saveStatus={saveStatus}
            showAndroidWarning={isAndroid}
            onPatch={updateSelectedScript}
            onPrompt={() => setView('prompter')}
            onDuplicate={duplicateScript}
            onDelete={deleteSelectedScript}
            onExport={exportSelectedScript}
            onOpenLibrary={() => setView('library')}
          />
        )}

        {view === 'prompter' && (
          <PrompterPanel
            script={selectedScript}
            settings={appState.settings}
            showAndroidWarning={isAndroid}
            onSettingsChange={updateSettings}
            onScriptPatch={updateSelectedScript}
            onBack={() => setView('editor')}
          />
        )}
      </section>
    </main>
  )
}

interface ScriptListProps {
  scripts: ScriptItem[]
  selectedId: string
  onSelect: (id: string) => void
}

function ScriptList({ scripts, selectedId, onSelect }: ScriptListProps) {
  return (
    <div className="script-list">
      {scripts.map((script) => (
        <button key={script.id} className={`script-row ${script.id === selectedId ? 'is-selected' : ''}`} type="button" onClick={() => onSelect(script.id)}>
          <span>{script.title || 'Untitled'}</span>
          <small>{estimateMinutes(script.body)} min</small>
        </button>
      ))}
    </div>
  )
}

interface LibraryPanelProps {
  scripts: ScriptItem[]
  selectedScript: ScriptItem
  showAndroidWarning: boolean
  onCreate: () => void
  onImport: () => void
  onOpen: (id: string) => void
  onPrompt: (id: string) => void
}

function LibraryPanel({ scripts, selectedScript, showAndroidWarning, onCreate, onImport, onOpen, onPrompt }: LibraryPanelProps) {
  return (
    <div className="panel library-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Library</p>
          <h2>Your scripts</h2>
        </div>
        <div className="header-actions">
          <IconButton icon={Upload} label="Import script" onClick={onImport} />
          <IconButton icon={FilePlus2} label="Create script" onClick={onCreate} variant="solid" />
        </div>
      </div>

      {showAndroidWarning && <AndroidSpeechWarning />}

      <div className="script-grid">
        {scripts.map((script) => (
          <article key={script.id} className={`script-card ${script.id === selectedScript.id ? 'is-selected' : ''}`}>
            <div>
              <h3>{script.title || 'Untitled'}</h3>
              <p>{previewText(script.body)}</p>
            </div>
            <div className="card-meta">
              <span>{estimateMinutes(script.body)} min estimated</span>
              <span>{new Date(script.updatedAt).toLocaleDateString('en-US')}</span>
            </div>
            <div className="card-actions">
              <button className="secondary-action" type="button" onClick={() => onOpen(script.id)}>
                Edit
              </button>
              <button className="primary-action" type="button" onClick={() => onPrompt(script.id)}>
                <Video aria-hidden="true" size={17} />
                Prompter
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

interface EditorPanelProps {
  script: ScriptItem
  settings: PrompterSettings
  saveStatus: SaveStatus
  showAndroidWarning: boolean
  onPatch: (patch: Partial<ScriptItem>) => void
  onPrompt: () => void
  onDuplicate: () => void
  onDelete: () => void
  onExport: () => void
  onOpenLibrary: () => void
}

function EditorPanel({ script, settings, saveStatus, showAndroidWarning, onPatch, onPrompt, onDuplicate, onDelete, onExport, onOpenLibrary }: EditorPanelProps) {
  const wordCount = useMemo(() => script.body.trim().split(/\s+/).filter(Boolean).length, [script.body])

  return (
    <div className="panel editor-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Editor</p>
          <h2>Prepare the take</h2>
        </div>
        <div className="header-actions">
          <IconButton icon={Library} label="Open library" onClick={onOpenLibrary} />
          <IconButton icon={Copy} label="Duplicate script" onClick={onDuplicate} />
          <IconButton icon={Download} label="Export text" onClick={onExport} />
          <IconButton icon={Trash2} label="Delete script" onClick={onDelete} variant="danger" />
        </div>
      </div>

      {showAndroidWarning && <AndroidSpeechWarning />}

      <div className="editor-layout">
        <section className="editor-card">
          <label className="field-label" htmlFor="script-title">
            Title
          </label>
          <input id="script-title" className="title-input" value={script.title} onChange={(event) => onPatch({ title: event.target.value })} />

          <label className="field-label" htmlFor="script-body">
            Script
          </label>
          <textarea id="script-body" className="script-editor" value={script.body} onChange={(event) => onPatch({ body: event.target.value })} spellCheck="true" />
        </section>

        <aside className="prep-card">
          <div className="prep-stat">
            <span>{wordCount}</span>
            <small>words</small>
          </div>
          <div className="prep-stat">
            <span>{estimateMinutes(script.body, settings.speed)}</span>
            <small>min a {settings.speed.toFixed(1)}x</small>
          </div>
          <div className="check-list">
            <p>
              <Check aria-hidden="true" size={16} />
              {saveStatus}
            </p>
            <p>
              <Mic aria-hidden="true" size={16} />
              Voice in {settings.language}
            </p>
            <p>
              <Wand2 aria-hidden="true" size={16} />
              {settings.layout === 'overlay' ? 'Text over camera' : 'Split view'}
            </p>
          </div>
          <button className="record-launch" type="button" onClick={onPrompt}>
            <Video aria-hidden="true" size={20} />
            Open prompter
          </button>
        </aside>
      </div>
    </div>
  )
}

interface PrompterPanelProps {
  script: ScriptItem
  settings: PrompterSettings
  showAndroidWarning: boolean
  onSettingsChange: (patch: Partial<PrompterSettings>) => void
  onScriptPatch: (patch: Partial<ScriptItem>) => void
  onBack: () => void
}

function PrompterPanel({ script, settings, showAndroidWarning, onSettingsChange, onScriptPatch, onBack }: PrompterPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const pendingRecordingStreamRef = useRef<MediaStream | null>(null)
  const lastFacingRef = useRef(settings.cameraFacing)
  const { stream, permission, error: mediaError, hasCamera, hasMic, requestMedia, stopMedia } = useMediaController(videoRef, settings.cameraFacing)
  const lines = useMemo(() => splitScript(script.body), [script.body])
  const [activeLine, setActiveLine] = useState(() => clamp(script.lastPosition, 0, lines.length - 1))
  const [isPlaying, setIsPlaying] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [recordedUrl, setRecordedUrl] = useState('')
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedMime, setRecordedMime] = useState('')
  const [recordingError, setRecordingError] = useState('')
  const [shareError, setShareError] = useState('')
  const [keepAwake, setKeepAwake] = useState(true)
  const [showChrome, setShowChrome] = useState(true)
  const [showReadingPanel, setShowReadingPanel] = useState(true)
  const [zoomMode, setZoomMode] = useState<'hardware' | 'preview'>('preview')
  const wakeLockStatus = useWakeLock(keepAwake && (isPlaying || isRecording || countdown > 0))
  const progress = Math.round(((activeLine + 1) / lines.length) * 100)

  const moveToLine = useCallback(
    (index: number) => {
      setActiveLine(clamp(index, 0, lines.length - 1))
    },
    [lines.length],
  )

  const handleVoiceCommand = useCallback(
    (command: 'next' | 'previous' | 'reset' | 'pause') => {
      if (command === 'next') {
        setActiveLine((current) => clamp(current + 1, 0, lines.length - 1))
      }

      if (command === 'previous') {
        setActiveLine((current) => clamp(current - 1, 0, lines.length - 1))
      }

      if (command === 'reset') {
        moveToLine(0)
      }

      if (command === 'pause') {
        setIsPlaying(false)
      }
    },
    [lines.length, moveToLine],
  )

  const speech = useSpeechFollower({
    enabled: settings.voiceFollow,
    language: settings.language,
    lines,
    currentIndex: activeLine,
    commandsEnabled: settings.voiceCommands,
    trackingActive: isPlaying,
    onLineMatched: moveToLine,
    onCommand: handleVoiceCommand,
  })

  useEffect(() => {
    onScriptPatch({ lastPosition: activeLine })
  }, [activeLine, onScriptPatch])

  useEffect(() => {
    if (lastFacingRef.current === settings.cameraFacing) {
      return
    }

    lastFacingRef.current = settings.cameraFacing

    if (stream) {
      void requestMedia()
    }
  }, [requestMedia, settings.cameraFacing, stream])

  useEffect(() => {
    if (!isPlaying || settings.voiceFollow) {
      return undefined
    }

    const interval = window.setInterval(() => {
      setActiveLine((current) => clamp(current + 1, 0, lines.length - 1))
    }, 3600 / settings.speed)

    return () => window.clearInterval(interval)
  }, [isPlaying, lines.length, settings.speed, settings.voiceFollow])

  useEffect(() => {
    if (!isRecording || recordingStartedAt === null) {
      return undefined
    }

    const interval = window.setInterval(() => {
      setElapsed((Date.now() - recordingStartedAt) / 1000)
    }, 250)

    return () => window.clearInterval(interval)
  }, [isRecording, recordingStartedAt])

  useEffect(() => {
    const track = stream?.getVideoTracks()[0]
    const capabilities = track?.getCapabilities?.() as MediaTrackCapabilities & { zoom?: { min: number; max: number; step?: number } }

    if (!track || !capabilities?.zoom) {
      setZoomMode('preview')
      return
    }

    const nextZoom = clamp(settings.zoom, capabilities.zoom.min, capabilities.zoom.max)

    track
      .applyConstraints({ advanced: [{ zoom: nextZoom } as MediaTrackConstraintSet] })
      .then(() => setZoomMode('hardware'))
      .catch(() => setZoomMode('preview'))
  }, [settings.zoom, stream])

  const beginRecording = useCallback(
    (liveStream: MediaStream) => {
      try {
        const mimeType = pickRecordingMimeType()
        const recorder = mimeType ? new MediaRecorder(liveStream, { mimeType }) : new MediaRecorder(liveStream)
        chunksRef.current = []
        recorderRef.current = recorder

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data)
          }
        }

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' })
          const url = URL.createObjectURL(blob)
          setRecordedBlob(blob)
          setRecordedUrl((currentUrl) => {
            if (currentUrl) {
              URL.revokeObjectURL(currentUrl)
            }
            return url
          })
          setRecordedMime(blob.type)
          setIsRecording(false)
          setRecordingStartedAt(null)
        }

        recorder.start(1000)
        pendingRecordingStreamRef.current = null
        setRecordedUrl('')
        setRecordedBlob(null)
        setRecordedMime(mimeType || 'video/webm')
        setShareError('')
        setElapsed(0)
        setRecordingStartedAt(Date.now())
        setIsRecording(true)
        setIsPlaying(true)
      } catch (recordError) {
        pendingRecordingStreamRef.current = null
        setRecordingError(recordError instanceof Error ? recordError.message : 'Could not start recording.')
      }
    },
    [],
  )

  useEffect(() => {
    if (countdown <= 0) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      if (countdown === 1) {
        const liveStream = pendingRecordingStreamRef.current
        setCountdown(0)

        if (liveStream) {
          beginRecording(liveStream)
        } else {
          setRecordingError('Camera or microphone became unavailable.')
        }

        return
      }

      setCountdown((current) => current - 1)
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [beginRecording, countdown])

  const startRecording = useCallback(async () => {
    setRecordingError('')
    setShareError('')

    if (countdown > 0) {
      pendingRecordingStreamRef.current = null
      setCountdown(0)
      return
    }

    if (!window.MediaRecorder) {
      setRecordingError('Browser recording is not available on this device.')
      return
    }

    const liveStream = stream ?? (await requestMedia())

    if (!liveStream) {
      setRecordingError('Enable camera or microphone before recording.')
      return
    }

    pendingRecordingStreamRef.current = liveStream
    setCountdown(3)
  }, [countdown, requestMedia, stream])

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop()
  }, [])

  const downloadRecording = useCallback(() => {
    if (!recordedUrl) {
      return
    }

    const extension = getRecordingExtension(recordedMime)
    downloadUrl(recordedUrl, fileNameForScript(script, extension))
  }, [recordedMime, recordedUrl, script])

  const dismissRecording = useCallback(() => {
    setRecordedUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
      }

      return ''
    })
    setRecordedBlob(null)
    setRecordedMime('')
    setShareError('')
  }, [])

  const shareRecording = useCallback(async () => {
    if (!recordedBlob) {
      return
    }

    setShareError('')
    const extension = getRecordingExtension(recordedMime)
    const file = new File([recordedBlob], fileNameForScript(script, extension), {
      type: recordedBlob.type || recordedMime || 'video/webm',
    })

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: script.title || 'Take',
          text: 'Take recorded in PromptFlow',
        })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setShareError('Could not open sharing. Download the take instead.')
        return
      }
    }

    setShareError('File sharing is not available in this browser.')
  }, [recordedBlob, recordedMime, script])

  const handleKeyboardShortcut = useCallback(
    (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target)) {
        return
      }

      if (event.key === ' ' && !event.repeat) {
        event.preventDefault()
        setIsPlaying((current) => !current)
        return
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault()
        setActiveLine((current) => clamp(current + 1, 0, lines.length - 1))
        return
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault()
        setActiveLine((current) => clamp(current - 1, 0, lines.length - 1))
        return
      }

      if (event.key === 'Home') {
        event.preventDefault()
        moveToLine(0)
        return
      }

      if (event.key === 'Escape' && !event.repeat) {
        event.preventDefault()

        if (recordedUrl) {
          dismissRecording()
          return
        }

        if (showReadingPanel) {
          setShowReadingPanel(false)
          return
        }

        if (!showChrome) {
          setShowChrome(true)
          return
        }

        onBack()
      }
    },
    [dismissRecording, lines.length, moveToLine, onBack, recordedUrl, showChrome, showReadingPanel],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyboardShortcut)
    return () => window.removeEventListener('keydown', handleKeyboardShortcut)
  }, [handleKeyboardShortcut])

  const recordingStatusText = countdown > 0 ? `Recording starts in ${countdown}` : isRecording ? `Recording active, ${formatDuration(elapsed)}` : recordedUrl ? 'Take ready for review' : 'Recording stopped'
  const prompterStatusText = `${progress}% read. ${settings.voiceFollow ? voiceStatusText(speech.status) : 'Manual voice'}. ${hasMic ? 'Microphone active' : 'Microphone pending'}. Camera ${settings.cameraFacing === 'user' ? 'front' : 'rear'}. Screen ${wakeLockText(wakeLockStatus)}. ${recordingStatusText}.`

  return (
    <div
      className={`prompter-stage layout-${settings.layout} order-${settings.splitOrder} ${showChrome ? '' : 'chrome-hidden'}`}
      style={
        {
          '--prompter-font-size': `${settings.fontSize}px`,
          '--prompter-line-height': settings.lineHeight,
          '--prompter-text-width': `${settings.textWidth}%`,
          '--overlay-opacity': settings.overlayOpacity,
          '--camera-zoom': settings.zoom,
        } as React.CSSProperties
      }
    >
      <header className="prompter-topbar">
        <IconButton icon={ArrowLeft} label="Back to editor" onClick={onBack} />
        <div className="session-title" aria-live="polite">
          <strong>{script.title || 'Untitled'}</strong>
          <span>{isRecording ? `Recording ${formatDuration(elapsed)}` : `${progress}% read`}</span>
        </div>
        <IconButton icon={showReadingPanel ? SlidersHorizontal : Settings} label={showReadingPanel ? 'Hide settings' : 'Show settings'} active={showReadingPanel} onClick={() => setShowReadingPanel((current) => !current)} />
        <IconButton icon={EyeOff} label="Hide interface" onClick={() => setShowChrome(false)} />
        <div className={`record-dot ${isRecording ? 'is-live' : ''}`} aria-hidden="true" />
        <span className="visually-hidden" role="status" aria-live="polite">
          {recordingStatusText}
        </span>
      </header>

      {!showChrome && <IconButton className="prompter-chrome-toggle" icon={Eye} label="Show interface" onClick={() => setShowChrome(true)} variant="solid" />}

      <section className="stage-body" aria-label="Prompter">
        <CameraPane
          videoRef={videoRef}
          hasCamera={hasCamera}
          permission={permission}
          mediaError={mediaError}
          mirror={settings.mirror}
          zoomMode={zoomMode}
          zoom={settings.zoom}
          cameraFacing={settings.cameraFacing}
          onRequestMedia={requestMedia}
        />

        <ScriptPane
          lines={lines}
          activeLine={activeLine}
          lineStep={settings.fontSize * settings.lineHeight + 20}
          matchedWordCount={speech.matchedWordCount}
          onLineSelect={moveToLine}
        />
      </section>

      {showChrome && showReadingPanel && (
        <aside className="reading-panel" aria-label="Reading settings">
          <div className="reading-panel-header">
            <span>Settings</span>
            <IconButton icon={X} label="Close settings" onClick={() => setShowReadingPanel(false)} />
          </div>
          <label>
            <Type aria-hidden="true" size={16} />
            Text
            <input type="range" min="22" max="58" value={settings.fontSize} onChange={(event) => onSettingsChange({ fontSize: Number(event.target.value) })} />
          </label>
          <label>
            <SlidersHorizontal aria-hidden="true" size={16} />
            Speed
            <input type="range" min="0.5" max="2.5" step="0.1" value={settings.speed} onChange={(event) => onSettingsChange({ speed: Number(event.target.value) })} />
          </label>
          <label>
            <ZoomIn aria-hidden="true" size={16} />
            Zoom {settings.zoom.toFixed(1)}x
            <input type="range" min="1" max="3" step="0.1" value={settings.zoom} onChange={(event) => onSettingsChange({ zoom: Number(event.target.value) })} />
          </label>
          <label>
            <Languages aria-hidden="true" size={16} />
            Language
            <select value={settings.language} onChange={(event) => onSettingsChange({ language: event.target.value })}>
              <option value="es-ES">Spanish</option>
              <option value="en-US">English</option>
              <option value="fr-FR">Francais</option>
              <option value="de-DE">Deutsch</option>
              <option value="it-IT">Italiano</option>
              <option value="pt-PT">Portuguese</option>
            </select>
          </label>
        </aside>
      )}

      {showChrome && showAndroidWarning && settings.voiceFollow && <AndroidSpeechWarning className="prompter-warning" compact />}

      {countdown > 0 && (
        <div className="countdown-overlay" aria-live="assertive" aria-label={`Recording in ${countdown}`}>
          <span>{countdown}</span>
        </div>
      )}

      {showChrome && recordedUrl && (
        <section className="take-review" aria-label="Take review" aria-live="polite">
          <IconButton className="take-close" icon={X} label="Close recorded take" onClick={dismissRecording} />
          <video src={recordedUrl} controls playsInline />
          <div>
            <strong>Take ready</strong>
            <span>{recordedMime || 'video'}</span>
          </div>
          <div className="take-actions">
            <button className="secondary-action" type="button" onClick={downloadRecording}>
              <Download aria-hidden="true" size={16} />
              Download
            </button>
            <button className="primary-action" type="button" onClick={shareRecording}>
              <Share2 aria-hidden="true" size={16} />
              Share
            </button>
          </div>
          {shareError && <p>{shareError}</p>}
        </section>
      )}

      {showChrome && (
      <footer className="prompter-dock">
        <IconButton icon={isPlaying ? Pause : Play} label={isPlaying ? 'Pause reading' : 'Start reading'} active={isPlaying} onClick={() => setIsPlaying((current) => !current)} variant="solid" />
        <IconButton icon={RotateCcw} label="Restart script" onClick={() => moveToLine(0)} />
        <IconButton icon={Minus} label="Previous line" onClick={() => moveToLine(activeLine - 1)} />
        <IconButton icon={Plus} label="Next line" onClick={() => moveToLine(activeLine + 1)} />
        <IconButton icon={showReadingPanel ? SlidersHorizontal : Settings} label={showReadingPanel ? 'Hide settings' : 'Show settings'} active={showReadingPanel} onClick={() => setShowReadingPanel((current) => !current)} />
        <IconButton icon={settings.voiceFollow ? Mic : MicOff} label="Toggle voice-following" active={settings.voiceFollow} onClick={() => onSettingsChange({ voiceFollow: !settings.voiceFollow })} />
        <IconButton
          icon={settings.layout === 'overlay' ? Wand2 : ArrowLeftRight}
          label="Switch overlay and split"
          active={settings.layout === 'split'}
          onClick={() => onSettingsChange({ layout: settings.layout === 'overlay' ? 'split' : 'overlay' })}
        />
        <IconButton
          icon={ArrowLeftRight}
          label="Swap split side"
          onClick={() => onSettingsChange({ splitOrder: settings.splitOrder === 'script-first' ? 'camera-first' : 'script-first' })}
        />
        <IconButton
          icon={hasCamera ? CameraOff : Camera}
          label={hasCamera ? 'Stop camera' : 'Enable camera'}
          active={hasCamera}
          disabled={isRecording || countdown > 0}
          onClick={hasCamera ? stopMedia : () => void requestMedia()}
        />
        <IconButton
          icon={SwitchCamera}
          label="Switch front or rear camera"
          active={settings.cameraFacing === 'environment'}
          disabled={isRecording || countdown > 0}
          onClick={() => onSettingsChange({ cameraFacing: settings.cameraFacing === 'user' ? 'environment' : 'user' })}
        />
        <IconButton icon={RefreshCcw} label="Toggle mirror" active={settings.mirror} onClick={() => onSettingsChange({ mirror: !settings.mirror })} />
        <IconButton
          icon={isRecording || countdown > 0 ? Square : CircleDot}
          label={isRecording ? 'Stop recording' : countdown > 0 ? 'Cancel countdown' : 'Record'}
          active={isRecording || countdown > 0}
          variant={isRecording || countdown > 0 ? 'danger' : 'glass'}
          onClick={isRecording ? stopRecording : startRecording}
        />
        <IconButton icon={MonitorUp} label="Keep screen awake" active={keepAwake} onClick={() => setKeepAwake((current) => !current)} />
        <IconButton icon={settings.theme === 'light' ? Moon : settings.theme === 'dark' ? Sun : Settings} label="Change theme" onClick={() => onSettingsChange({ theme: nextTheme(settings.theme) })} />
        <IconButton icon={EyeOff} label="Hide interface" onClick={() => setShowChrome(false)} />
      </footer>
      )}

      {showChrome && (
      <div className="status-strip" role="status" aria-live="polite" aria-label={prompterStatusText}>
        <span className={`status-pill status-${speech.status}`}>
          {settings.voiceFollow ? voiceStatusText(speech.status) : 'Manual voice'}
        </span>
        <span className="status-pill">{hasMic ? 'Mic active' : 'Mic pending'}</span>
        <span className="status-pill">Camera {settings.cameraFacing === 'user' ? 'front' : 'rear'}</span>
        {countdown > 0 && <span className="status-pill status-countdown">Recording in {countdown}</span>}
        <span className="status-pill">Zoom {zoomMode}</span>
        <span className="status-pill">Screen {wakeLockText(wakeLockStatus)}</span>
        <span className="status-pill">v{__APP_VERSION__}</span>
        {recordingError && <span className="status-pill status-error" role="alert">{recordingError}</span>}
        {shareError && <span className="status-pill status-error" role="alert">{shareError}</span>}
        {speech.error && <span className="status-pill">{speech.error}</span>}
        {recordedUrl && (
          <button className="status-pill status-button" type="button" onClick={downloadRecording}>
            Download take
          </button>
        )}
      </div>
      )}
    </div>
  )
}

interface CameraPaneProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  hasCamera: boolean
  permission: string
  mediaError: string
  mirror: boolean
  zoomMode: 'hardware' | 'preview'
  zoom: number
  cameraFacing: 'user' | 'environment'
  onRequestMedia: () => Promise<MediaStream | null>
}

function CameraPane({ videoRef, hasCamera, permission, mediaError, mirror, zoomMode, zoom, cameraFacing, onRequestMedia }: CameraPaneProps) {
  const shouldShowPermissionCard = !hasCamera && permission !== 'idle'

  return (
    <div className={`camera-pane ${mirror ? 'is-mirrored' : ''} ${zoomMode === 'preview' ? 'uses-preview-zoom' : ''}`} aria-label="Camera view">
      <video ref={videoRef} autoPlay playsInline muted />
      {shouldShowPermissionCard && (
        <div className="permission-card">
          <VideoOff aria-hidden="true" size={32} />
          <h3>{permission === 'requesting' ? 'Requesting permission' : 'Camera pending'}</h3>
          <p>{mediaError || 'Enable camera and microphone to record while reading.'}</p>
          <button className="primary-action" type="button" onClick={onRequestMedia}>
            <Video aria-hidden="true" size={17} />
            Enable
          </button>
        </div>
      )}
      <div className="camera-badge">
        {cameraFacing === 'user' ? 'Front' : 'Rear'} · {mirror ? 'Mirrored' : 'Normal'} view · {zoom.toFixed(1)}x
      </div>
    </div>
  )
}

interface ScriptPaneProps {
  lines: string[]
  activeLine: number
  lineStep: number
  matchedWordCount: number
  onLineSelect: (index: number) => void
}

function ScriptPane({ lines, activeLine, lineStep, matchedWordCount, onLineSelect }: ScriptPaneProps) {
  const activeVoiceProgress = useMemo(
    () => getLineVoiceProgress(lines[activeLine] ?? '', '', { fixedMatchedWordCount: matchedWordCount }),
    [activeLine, lines, matchedWordCount],
  )

  return (
    <div className="script-pane" aria-label="Prompter text">
      <div className="script-track" style={{ transform: `translateY(calc(var(--active-offset) - ${activeLine * lineStep}px))` }}>
        {lines.map((line, index) => (
          <button
            key={`${line}-${index}`}
            type="button"
            className={`script-line ${index === activeLine ? 'is-active' : ''}`}
            aria-current={index === activeLine ? 'true' : undefined}
            aria-label={`Line ${index + 1}${index === activeLine ? ', current' : ''}: ${line}`}
            onClick={() => onLineSelect(index)}
          >
            {index === activeLine ? <HighlightedLine line={line} matchedIndexes={activeVoiceProgress.matchedIndexes} /> : line}
          </button>
        ))}
      </div>
    </div>
  )
}

interface HighlightedLineProps {
  line: string
  matchedIndexes: Set<number>
}

function HighlightedLine({ line, matchedIndexes }: HighlightedLineProps) {
  let wordIndex = 0

  return (
    <>
      {line.split(/([\p{L}\p{N}]+)/gu).map((part, index) => {
        if (!/^[\p{L}\p{N}]+$/u.test(part)) {
          return part
        }

        const currentWordIndex = wordIndex
        wordIndex += 1

        return (
          <span key={`${part}-${index}`} className={`script-word ${matchedIndexes.has(currentWordIndex) ? 'is-spoken' : ''}`}>
            {part}
          </span>
        )
      })}
    </>
  )
}

interface AndroidSpeechWarningProps {
  className?: string
  compact?: boolean
}

function AndroidSpeechWarning({ className = '', compact = false }: AndroidSpeechWarningProps) {
  return (
    <aside className={`android-warning ${className}`} role="note" aria-label="Android voice recognition notice">
      <AlertTriangle aria-hidden="true" size={compact ? 18 : 22} />
      <div>
        <strong>Limited voice recognition on Android</strong>
        {!compact && <p>On some Android devices and browsers, the microphone may start and stop repeatedly. If that happens, use the manual controls or try iOS, Safari, or desktop.</p>}
      </div>
    </aside>
  )
}

function previewText(body: string) {
  return body.trim().replace(/\s+/g, ' ').slice(0, 124) || 'Empty script. Open the editor to get started.'
}

function isAndroidBrowser() {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
}

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

function nextTheme(theme: PrompterSettings['theme']): PrompterSettings['theme'] {
  if (theme === 'dark') {
    return 'light'
  }

  if (theme === 'light') {
    return 'contrast'
  }

  return defaultSettings.theme
}

function pickRecordingMimeType() {
  const candidates = ['video/mp4;codecs=h264,aac', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

function getRecordingExtension(mimeType: string): 'mp4' | 'webm' {
  return mimeType.includes('mp4') ? 'mp4' : 'webm'
}

function wakeLockText(status: string) {
  if (status === 'active') {
    return 'active'
  }

  if (status === 'unsupported') {
    return 'manual'
  }

  if (status === 'blocked') {
    return 'blocked'
  }

  return 'ready'
}

function voiceStatusText(status: string) {
  if (status === 'listening') {
    return 'Listening'
  }

  if (status === 'unsupported') {
    return 'Voice unavailable'
  }

  if (status === 'error') {
    return 'Voice error'
  }

  if (status === 'paused') {
    return 'Voice paused'
  }

  return 'Voice ready'
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  downloadUrl(url, fileName)
  window.setTimeout(() => URL.revokeObjectURL(url), 3000)
}

function downloadUrl(url: string, fileName: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
}

export default App
