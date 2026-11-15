import { useState, useEffect, useCallback } from 'react'
import { useChat } from './hooks/useChat'
import { Titlebar } from './components/Titlebar'
import { ChatView } from './components/ChatView'
import { Sidebar } from './components/Sidebar'
import { ModelId, ModelStates } from './api'

function App() {
  const [serverStatus, setServerStatus] = useState<string>('starting')
  const [serverPort, setServerPort] = useState<number | null>(null)
  const [systemInstructions, setSystemInstructions] = useState(() => localStorage.getItem('fmcui.instructions') || '')
  const [showSettings, setShowSettings] = useState(false)
  const [model, setModel] = useState<ModelId>('system')
  const [models, setModels] = useState<ModelStates>({
    system: { available: true },
    pcc: { available: false, reason: 'Checking Private Cloud Compute availability…' },
  })

  const chat = useChat(serverPort)

  // ── Initialize from Electron IPC or fallback ─────────────────────
  useEffect(() => {
    if (window.fmAPI) {
      window.fmAPI.getServerPort().then(port => {
        if (port) setServerPort(port)
      })
      window.fmAPI.getServerStatus().then(setServerStatus)
      window.fmAPI.getModels().then(setModels)
      const cleanup = window.fmAPI.onServerStatusChange(status => {
        setServerStatus(status)
        if (status === 'running') {
          window.fmAPI!.getServerPort().then(port => {
            if (port) setServerPort(port)
          })
        }
      })
      const cleanupModels = window.fmAPI.onModelsChange(setModels)
      return () => { cleanup(); cleanupModels() }
    } else {
      setServerPort(8462)
      fetch('/v1/models').then(response => {
        if (!response.ok) throw new Error('Model server unavailable')
        return response.json()
      }).then(payload => {
        setServerStatus('running')
        const entries = payload.data ?? payload.models ?? []
        const pcc = entries.find((item: { id?: string; name?: string }) => (item.id ?? item.name) === 'pcc')
        setModels({ system: { available: true }, pcc: pcc ? { available: pcc.available !== false, reason: pcc.reason } : { available: false, reason: 'Private Cloud Compute is not offered by this fm server.' } })
      }).catch(() => {
        setServerStatus('error')
        setModels(previous => ({ ...previous, pcc: { available: false, reason: 'Connect to fm serve to check cloud availability.' } }))
      })
    }
  }, [])

  useEffect(() => {
    if (model === 'pcc' && !models.pcc.available) setModel('system')
  }, [model, models.pcc.available])

  // ── Global keyboard shortcut: Escape to stop generation ──────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && chat.isStreaming) {
        chat.stopGeneration()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [chat.isStreaming, chat.stopGeneration])

  const handleSend = useCallback(
    (content: string) => {
      chat.sendMessage(content, model, systemInstructions || undefined)
    },
    [chat.sendMessage, model, systemInstructions]
  )

  const handleRetry = useCallback(async () => {
    if (window.fmAPI) {
      const result = await window.fmAPI.restartServer()
      setServerPort(result.port)
      setServerStatus(result.status)
    }
  }, [])

  const closeSettings = useCallback(() => {
    setSystemInstructions(localStorage.getItem('fmcui.instructions') || '')
    setShowSettings(false)
  }, [])

  const saveSettings = useCallback(() => {
    localStorage.setItem('fmcui.instructions', systemInstructions)
    setShowSettings(false)
  }, [systemInstructions])

  return (
    <div className="app">
      <Sidebar 
        chats={chat.chats}
        activeChatId={chat.activeChatId}
        onSelectChat={chat.selectChat}
        onDeleteChat={chat.deleteChat}
        onNewChat={chat.newChat}
        busy={chat.isStreaming}
      />
      
      <div className="main-area">
        <Titlebar
          serverStatus={serverStatus}
          onNewChat={chat.newChat}
          onToggleSettings={() => setShowSettings(true)}
          model={model}
          models={models}
          onModelChange={setModel}
          busy={chat.isStreaming}
          title={chat.chats.find(item => item.id === chat.activeChatId)?.title || 'New conversation'}
        />

        <ChatView
          messages={chat.messages}
          isStreaming={chat.isStreaming}
          error={chat.error}
          serverStatus={serverStatus}
          onSend={handleSend}
          onStop={chat.stopGeneration}
          onRetry={handleRetry}
          model={model}
        />
      </div>

      {/* ── System Instructions Modal ────────────────────────────── */}
      {showSettings && (
        <div className="modal-overlay" onClick={closeSettings}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') closeSettings() }}>
            <h2 className="modal-title" id="settings-title">System Instructions</h2>
            <p className="modal-description">
              Set custom instructions that shape how the model responds.
              Applied at the start of each conversation.
            </p>
            <textarea
              className="modal-textarea"
              value={systemInstructions}
              onChange={e => setSystemInstructions(e.target.value)}
              placeholder="e.g., You are a helpful coding assistant specializing in Swift and SwiftUI…"
              autoFocus
            />
            <div className="modal-actions">
              <button
                className="modal-btn modal-btn-secondary"
                onClick={closeSettings}
              >
                Cancel
              </button>
              <button
                className="modal-btn modal-btn-primary"
                onClick={saveSettings}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
