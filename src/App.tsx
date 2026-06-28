import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('Guardado')
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const selectedScript = useMemo(
    () => appState.scripts.find((script) => script.id === appState.selectedScriptId) ?? appState.scripts[0],
    [appState.scripts, appState.selectedScriptId],
  )

  useEffect(() => {
    try {
      setSaveStatus('Guardando')
      saveState(appState)
      const timer = window.setTimeout(() => setSaveStatus('Guardado'), 220)
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

    const script = createScript(`${selectedScript.title} copia`, selectedScript.body)
    setAppState((current) => ({
      ...current,
      scripts: [script, ...current.scripts],
      selectedScriptId: script.id,
    }))
    setView('editor')
  }, [selectedScript])

  const deleteSelectedScript = useCallback(() => {
    if (!selectedScript || !window.confirm(`Eliminar "${selectedScript.title}"?`)) {
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
    const title = file.name.replace(/\.[^.]+$/, '') || 'Guion importado'
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

      <aside className="library-rail" aria-label="Biblioteca de guiones">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            PF
          </div>
          <div>
            <p className="eyebrow">PromptFlow</p>
            <h1>Prompter movil</h1>
          </div>
        </div>

        <div className="rail-actions">
          <button className="primary-action" type="button" onClick={createNewScript}>
            <Plus aria-hidden="true" size={18} />
            Nuevo
          </button>
          <button className="secondary-action" type="button" onClick={() => importInputRef.current?.click()}>
            <Import aria-hidden="true" size={18} />
            Importar
          </button>
        </div>

        <ScriptList scripts={appState.scripts} selectedId={selectedScript.id} onSelect={(id) => selectScript(id, 'editor')} />

        <div className="rail-status">
          <Save aria-hidden="true" size={16} />
          <span>{saveStatus}</span>
        </div>
      </aside>

      <section className="workspace" aria-label="Area de trabajo">
        {view === 'library' && (
          <LibraryPanel
            scripts={appState.scripts}
            selectedScript={selectedScript}
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
          <span>{script.title || 'Sin titulo'}</span>
          <small>{estimateMinutes(script.body)} min</small>
        </button>
      ))}
    </div>
  )
}

interface LibraryPanelProps {
  scripts: ScriptItem[]
  selectedScript: ScriptItem
  onCreate: () => void
  onImport: () => void
  onOpen: (id: string) => void
  onPrompt: (id: string) => void
}

function LibraryPanel({ scripts, selectedScript, onCreate, onImport, onOpen, onPrompt }: LibraryPanelProps) {
  return (
    <div className="panel library-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Biblioteca</p>
          <h2>Tus guiones</h2>
        </div>
        <div className="header-actions">
          <IconButton icon={Upload} label="Importar guion" onClick={onImport} />
          <IconButton icon={FilePlus2} label="Crear guion" onClick={onCreate} variant="solid" />
        </div>
      </div>

      <div className="script-grid">
        {scripts.map((script) => (
          <article key={script.id} className={`script-card ${script.id === selectedScript.id ? 'is-selected' : ''}`}>
            <div>
              <h3>{script.title || 'Sin titulo'}</h3>
              <p>{previewText(script.body)}</p>
            </div>
            <div className="card-meta">
              <span>{estimateMinutes(script.body)} min estimados</span>
              <span>{new Date(script.updatedAt).toLocaleDateString('es-ES')}</span>
            </div>
            <div className="card-actions">
              <button className="secondary-action" type="button" onClick={() => onOpen(script.id)}>
                Editar
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
  onPatch: (patch: Partial<ScriptItem>) => void
  onPrompt: () => void
  onDuplicate: () => void
  onDelete: () => void
  onExport: () => void
  onOpenLibrary: () => void
}

function EditorPanel({ script, settings, saveStatus, onPatch, onPrompt, onDuplicate, onDelete, onExport, onOpenLibrary }: EditorPanelProps) {
  const wordCount = useMemo(() => script.body.trim().split(/\s+/).filter(Boolean).length, [script.body])

  return (
    <div className="panel editor-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Editor</p>
          <h2>Prepara la toma</h2>
        </div>
        <div className="header-actions">
          <IconButton icon={Library} label="Abrir biblioteca" onClick={onOpenLibrary} />
          <IconButton icon={Copy} label="Duplicar guion" onClick={onDuplicate} />
          <IconButton icon={Download} label="Exportar texto" onClick={onExport} />
          <IconButton icon={Trash2} label="Eliminar guion" onClick={onDelete} variant="danger" />
        </div>
      </div>

      <div className="editor-layout">
        <section className="editor-card">
          <label className="field-label" htmlFor="script-title">
            Titulo
          </label>
          <input id="script-title" className="title-input" value={script.title} onChange={(event) => onPatch({ title: event.target.value })} />

          <label className="field-label" htmlFor="script-body">
            Guion
          </label>
          <textarea id="script-body" className="script-editor" value={script.body} onChange={(event) => onPatch({ body: event.target.value })} spellCheck="true" />
        </section>

        <aside className="prep-card">
          <div className="prep-stat">
            <span>{wordCount}</span>
            <small>palabras</small>
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
              Voz en {settings.language}
            </p>
            <p>
              <Wand2 aria-hidden="true" size={16} />
              {settings.layout === 'overlay' ? 'Texto sobre camara' : 'Vista dividida'}
            </p>
          </div>
          <button className="record-launch" type="button" onClick={onPrompt}>
            <Video aria-hidden="true" size={20} />
            Abrir prompter
          </button>
        </aside>
      </div>
    </div>
  )
}

interface PrompterPanelProps {
  script: ScriptItem
  settings: PrompterSettings
  onSettingsChange: (patch: Partial<PrompterSettings>) => void
  onScriptPatch: (patch: Partial<ScriptItem>) => void
  onBack: () => void
}

function PrompterPanel({ script, settings, onSettingsChange, onScriptPatch, onBack }: PrompterPanelProps) {
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
  const speechEnabled = settings.voiceFollow && (!isAndroidBrowser() || isPlaying)

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
    enabled: speechEnabled,
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
        setRecordingError(recordError instanceof Error ? recordError.message : 'No se pudo iniciar la grabacion.')
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
          setRecordingError('La camara o el microfono dejaron de estar disponibles.')
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
      setRecordingError('La grabacion desde navegador no esta disponible en este dispositivo.')
      return
    }

    const liveStream = stream ?? (await requestMedia())

    if (!liveStream) {
      setRecordingError('Activa camara o microfono antes de grabar.')
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
          title: script.title || 'Toma',
          text: 'Toma grabada en PromptFlow',
        })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setShareError('No se pudo abrir compartir. Descarga la toma como alternativa.')
        return
      }
    }

    setShareError('Compartir archivo no esta disponible en este navegador.')
  }, [recordedBlob, recordedMime, script])

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
        <IconButton icon={ArrowLeft} label="Volver al editor" onClick={onBack} />
        <div className="session-title">
          <strong>{script.title || 'Sin titulo'}</strong>
          <span>{isRecording ? `Grabando ${formatDuration(elapsed)}` : `${progress}% leido`}</span>
        </div>
        <IconButton icon={showReadingPanel ? SlidersHorizontal : Settings} label={showReadingPanel ? 'Ocultar ajustes' : 'Mostrar ajustes'} active={showReadingPanel} onClick={() => setShowReadingPanel((current) => !current)} />
        <IconButton icon={EyeOff} label="Ocultar interfaz" onClick={() => setShowChrome(false)} />
        <div className={`record-dot ${isRecording ? 'is-live' : ''}`} aria-label={isRecording ? 'Grabacion activa' : 'Grabacion detenida'} />
      </header>

      {!showChrome && <IconButton className="prompter-chrome-toggle" icon={Eye} label="Mostrar interfaz" onClick={() => setShowChrome(true)} variant="solid" />}

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
        <aside className="reading-panel" aria-label="Ajustes de lectura">
          <div className="reading-panel-header">
            <span>Ajustes</span>
            <IconButton icon={X} label="Cerrar ajustes" onClick={() => setShowReadingPanel(false)} />
          </div>
          <label>
            <Type aria-hidden="true" size={16} />
            Texto
            <input type="range" min="22" max="58" value={settings.fontSize} onChange={(event) => onSettingsChange({ fontSize: Number(event.target.value) })} />
          </label>
          <label>
            <SlidersHorizontal aria-hidden="true" size={16} />
            Velocidad
            <input type="range" min="0.5" max="2.5" step="0.1" value={settings.speed} onChange={(event) => onSettingsChange({ speed: Number(event.target.value) })} />
          </label>
          <label>
            <ZoomIn aria-hidden="true" size={16} />
            Zoom {settings.zoom.toFixed(1)}x
            <input type="range" min="1" max="3" step="0.1" value={settings.zoom} onChange={(event) => onSettingsChange({ zoom: Number(event.target.value) })} />
          </label>
          <label>
            <Languages aria-hidden="true" size={16} />
            Idioma
            <select value={settings.language} onChange={(event) => onSettingsChange({ language: event.target.value })}>
              <option value="es-ES">Espanol</option>
              <option value="en-US">English</option>
              <option value="fr-FR">Francais</option>
              <option value="de-DE">Deutsch</option>
              <option value="it-IT">Italiano</option>
              <option value="pt-PT">Portugues</option>
            </select>
          </label>
        </aside>
      )}

      {countdown > 0 && (
        <div className="countdown-overlay" aria-live="assertive" aria-label={`Grabacion en ${countdown}`}>
          <span>{countdown}</span>
        </div>
      )}

      {showChrome && recordedUrl && (
        <section className="take-review" aria-label="Revision de toma">
          <IconButton className="take-close" icon={X} label="Cerrar toma grabada" onClick={dismissRecording} />
          <video src={recordedUrl} controls playsInline />
          <div>
            <strong>Toma lista</strong>
            <span>{recordedMime || 'video'}</span>
          </div>
          <div className="take-actions">
            <button className="secondary-action" type="button" onClick={downloadRecording}>
              <Download aria-hidden="true" size={16} />
              Descargar
            </button>
            <button className="primary-action" type="button" onClick={shareRecording}>
              <Share2 aria-hidden="true" size={16} />
              Compartir
            </button>
          </div>
          {shareError && <p>{shareError}</p>}
        </section>
      )}

      {showChrome && (
      <footer className="prompter-dock">
        <IconButton icon={isPlaying ? Pause : Play} label={isPlaying ? 'Pausar lectura' : 'Iniciar lectura'} active={isPlaying} onClick={() => setIsPlaying((current) => !current)} variant="solid" />
        <IconButton icon={RotateCcw} label="Reiniciar guion" onClick={() => moveToLine(0)} />
        <IconButton icon={Minus} label="Linea anterior" onClick={() => moveToLine(activeLine - 1)} />
        <IconButton icon={Plus} label="Linea siguiente" onClick={() => moveToLine(activeLine + 1)} />
        <IconButton icon={showReadingPanel ? SlidersHorizontal : Settings} label={showReadingPanel ? 'Ocultar ajustes' : 'Mostrar ajustes'} active={showReadingPanel} onClick={() => setShowReadingPanel((current) => !current)} />
        <IconButton icon={settings.voiceFollow ? Mic : MicOff} label="Alternar seguimiento por voz" active={settings.voiceFollow} onClick={() => onSettingsChange({ voiceFollow: !settings.voiceFollow })} />
        <IconButton
          icon={settings.layout === 'overlay' ? Wand2 : ArrowLeftRight}
          label="Alternar overlay y split"
          active={settings.layout === 'split'}
          onClick={() => onSettingsChange({ layout: settings.layout === 'overlay' ? 'split' : 'overlay' })}
        />
        <IconButton
          icon={ArrowLeftRight}
          label="Cambiar lado del split"
          onClick={() => onSettingsChange({ splitOrder: settings.splitOrder === 'script-first' ? 'camera-first' : 'script-first' })}
        />
        <IconButton
          icon={hasCamera ? CameraOff : Camera}
          label={hasCamera ? 'Detener camara' : 'Activar camara'}
          active={hasCamera}
          disabled={isRecording || countdown > 0}
          onClick={hasCamera ? stopMedia : () => void requestMedia()}
        />
        <IconButton
          icon={SwitchCamera}
          label="Cambiar camara frontal o trasera"
          active={settings.cameraFacing === 'environment'}
          disabled={isRecording || countdown > 0}
          onClick={() => onSettingsChange({ cameraFacing: settings.cameraFacing === 'user' ? 'environment' : 'user' })}
        />
        <IconButton icon={RefreshCcw} label="Alternar espejo" active={settings.mirror} onClick={() => onSettingsChange({ mirror: !settings.mirror })} />
        <IconButton
          icon={isRecording || countdown > 0 ? Square : CircleDot}
          label={isRecording ? 'Detener grabacion' : countdown > 0 ? 'Cancelar cuenta atras' : 'Grabar'}
          active={isRecording || countdown > 0}
          variant={isRecording || countdown > 0 ? 'danger' : 'glass'}
          onClick={isRecording ? stopRecording : startRecording}
        />
        <IconButton icon={MonitorUp} label="Mantener pantalla despierta" active={keepAwake} onClick={() => setKeepAwake((current) => !current)} />
        <IconButton icon={settings.theme === 'light' ? Moon : settings.theme === 'dark' ? Sun : Settings} label="Cambiar tema" onClick={() => onSettingsChange({ theme: nextTheme(settings.theme) })} />
        <IconButton icon={EyeOff} label="Ocultar interfaz" onClick={() => setShowChrome(false)} />
      </footer>
      )}

      {showChrome && (
      <div className="status-strip">
        <span className={`status-pill status-${speech.status}`}>
          {settings.voiceFollow ? voiceStatusText(speech.status) : 'Voz manual'}
        </span>
        <span className="status-pill">{hasMic ? 'Micro activo' : 'Micro pendiente'}</span>
        <span className="status-pill">Camara {settings.cameraFacing === 'user' ? 'frontal' : 'trasera'}</span>
        {countdown > 0 && <span className="status-pill status-countdown">Grabando en {countdown}</span>}
        <span className="status-pill">Zoom {zoomMode}</span>
        <span className="status-pill">Pantalla {wakeLockText(wakeLockStatus)}</span>
        {recordingError && <span className="status-pill status-error">{recordingError}</span>}
        {shareError && <span className="status-pill status-error">{shareError}</span>}
        {speech.error && <span className="status-pill">{speech.error}</span>}
        {recordedUrl && (
          <button className="status-pill status-button" type="button" onClick={downloadRecording}>
            Descargar toma
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
    <div className={`camera-pane ${mirror ? 'is-mirrored' : ''} ${zoomMode === 'preview' ? 'uses-preview-zoom' : ''}`} aria-label="Vista de camara">
      <video ref={videoRef} autoPlay playsInline muted />
      {shouldShowPermissionCard && (
        <div className="permission-card">
          <VideoOff aria-hidden="true" size={32} />
          <h3>{permission === 'requesting' ? 'Solicitando permiso' : 'Camara pendiente'}</h3>
          <p>{mediaError || 'Activa camara y microfono para grabar mientras lees.'}</p>
          <button className="primary-action" type="button" onClick={onRequestMedia}>
            <Video aria-hidden="true" size={17} />
            Activar
          </button>
        </div>
      )}
      <div className="camera-badge">
        {cameraFacing === 'user' ? 'Frontal' : 'Trasera'} · Vista {mirror ? 'espejo' : 'normal'} · {zoom.toFixed(1)}x
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
    <div className="script-pane" aria-label="Texto del prompter">
      <div className="script-track" style={{ transform: `translateY(calc(var(--active-offset) - ${activeLine * lineStep}px))` }}>
        {lines.map((line, index) => (
          <button key={`${line}-${index}`} type="button" className={`script-line ${index === activeLine ? 'is-active' : ''}`} onClick={() => onLineSelect(index)}>
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

function isAndroidBrowser() {
  return /Android/i.test(navigator.userAgent)
}

function previewText(body: string) {
  return body.trim().replace(/\s+/g, ' ').slice(0, 124) || 'Guion vacio. Abre el editor para empezar.'
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
    return 'activa'
  }

  if (status === 'unsupported') {
    return 'manual'
  }

  if (status === 'blocked') {
    return 'bloqueada'
  }

  return 'lista'
}

function voiceStatusText(status: string) {
  if (status === 'listening') {
    return 'Escuchando'
  }

  if (status === 'unsupported') {
    return 'Voz no disponible'
  }

  if (status === 'error') {
    return 'Error de voz'
  }

  if (status === 'paused') {
    return 'Voz pausada'
  }

  return 'Voz lista'
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
