import { useState, useEffect, useCallback } from 'react'
import { useChat } from './hooks/useChat'
import { Titlebar } from './components/Titlebar'
import { ChatView } from './components/ChatView'
import { Sidebar } from './components/Sidebar'

function App() {
  const [serverStatus, setServerStatus] = useState<string>('starting')
  const [serverPort, setServerPort] = useState<number | null>(null)
  const [systemInstructions, setSystemInstructions] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  const chat = useChat(serverPort)

  // ── Initialize from Electron IPC or fallback ─────────────────────
  useEffect(() => {
    if (window.fmAPI) {
      window.fmAPI.getServerPort().then(port => {
        if (port) setServerPort(port)
      })
      window.fmAPI.getServerStatus().then(setServerStatus)
      const cleanup = window.fmAPI.onServerStatusChange(status => {
        setServerStatus(status)
        if (status === 'running') {
          window.fmAPI!.getServerPort().then(port => {
            if (port) setServerPort(port)
          })
        }
      })
      return cleanup
    } else {
      setServerPort(8462)
      setServerStatus('running')
    }
  }, [])

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
      chat.sendMessage(content, systemInstructions || undefined)
    },
    [chat.sendMessage, systemInstructions]
  )

  const handleRetry = useCallback(async () => {
    if (window.fmAPI) {
      const result = await window.fmAPI.restartServer()
      setServerPort(result.port)
      setServerStatus(result.status)
    }
  }, [])

  return (
    <div className="app">
      <Sidebar 
        chats={chat.chats}
        activeChatId={chat.activeChatId}
        onSelectChat={chat.selectChat}
        onDeleteChat={chat.deleteChat}
      />
      
      <div className="main-area">
        <Titlebar
          serverStatus={serverStatus}
          onNewChat={chat.newChat}
          onToggleSettings={() => setShowSettings(true)}
        />

        <ChatView
          messages={chat.messages}
          isStreaming={chat.isStreaming}
          error={chat.error}
          serverStatus={serverStatus}
          onSend={handleSend}
          onStop={chat.stopGeneration}
          onRetry={handleRetry}
        />
      </div>

      {/* ── System Instructions Modal ────────────────────────────── */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">System Instructions</h2>
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
                onClick={() => setShowSettings(false)}
              >
                Cancel
              </button>
              <button
                className="modal-btn modal-btn-primary"
                onClick={() => setShowSettings(false)}
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
