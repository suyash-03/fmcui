import { useRef, useEffect } from 'react'
import { ChatMessage } from '../api'
import { MessageBubble } from './MessageBubble'
import { InputBar } from './InputBar'
import { WifiOff, AlertCircle, Sparkles } from 'lucide-react'
import { ModelId } from '../api'

interface ChatViewProps {
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
  serverStatus: string
  onSend: (content: string) => void
  onStop: () => void
  onRetry: () => void
  model: ModelId
}

const EXAMPLE_PROMPTS = [
  'What can you help me with?',
  'Explain Swift concurrency simply',
  'Help me write a SwiftUI view',
]

export function ChatView({
  messages,
  isStreaming,
  error,
  serverStatus,
  onSend,
  onStop,
  onRetry,
  model,
}: ChatViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isScrolledUpRef = useRef(false)

  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    isScrolledUpRef.current = scrollHeight - scrollTop - clientHeight > 60
  }

  // Auto-scroll to bottom on new content if not scrolled up
  useEffect(() => {
    if (!isScrolledUpRef.current) {
      const container = containerRef.current
      if (container) container.scrollTop = container.scrollHeight
    }
  }, [messages])

  // ── Connection Error States ───────────────────────────────────────
  if (serverStatus === 'not-found') {
    return (
      <div className="chat-view">
        <div className="connection-error">
          <div className="connection-error-icon">
            <AlertCircle size={28} />
          </div>
          <h2 className="connection-error-title">fm not found</h2>
          <p className="connection-error-text">
            Apple Foundation Models CLI isn't available on this system. Make sure
            you're running macOS 27 or later and have accepted the license agreement.
          </p>
          <code className="connection-error-code">sudo fm license</code>
          <button className="connection-error-btn" onClick={onRetry}>
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (serverStatus === 'starting') {
    return (
      <div className="chat-view">
        <div className="starting-overlay">
          <div className="starting-spinner" />
          <p className="starting-text">Starting Apple Foundation Model…</p>
          <p className="starting-subtext">Loading on-device model</p>
        </div>
      </div>
    )
  }

  if (serverStatus === 'error' && messages.length === 0) {
    return (
      <div className="chat-view">
        <div className="connection-error">
          <div className="connection-error-icon">
            <WifiOff size={28} />
          </div>
          <h2 className="connection-error-title">Connection Lost</h2>
          <p className="connection-error-text">
            The local model server stopped unexpectedly. This can happen if the
            system interrupted the process.
          </p>
          <button className="connection-error-btn" onClick={onRetry}>
            Restart Server
          </button>
        </div>
      </div>
    )
  }

  // ── Main Chat View ────────────────────────────────────────────────
  return (
    <div className="chat-view">
      <div 
        className="messages-container" 
        ref={containerRef} 
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-intro">
              <div className="empty-state-mark"><Sparkles size={31} strokeWidth={1.7} /></div>
              <h1 className="empty-state-title">Ask our AI anything</h1>
              <p className="empty-state-subtitle">Powered by Apple Foundation Models</p>
            </div>
            <div className="suggestions">
              <p>Suggestions to get started</p>
              <div className="example-prompts">
                {EXAMPLE_PROMPTS.map(prompt => <button key={prompt} className="example-prompt" onClick={() => onSend(prompt)} disabled={isStreaming || serverStatus !== 'running'}>{prompt}</button>)}
              </div>
            </div>
          </div>
        ) : (
          <div className="messages-inner">
            {error && (
              <div className="error-banner">
                <AlertCircle size={16} />
                <span>{error}</span>
                <button onClick={onRetry}>Restart model</button>
              </div>
            )}
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                message={msg}
                isStreaming={
                  isStreaming &&
                  i === messages.length - 1 &&
                  msg.role === 'assistant'
                }
              />
            ))}
          </div>
        )}
      </div>

      <InputBar
        onSend={onSend}
        onStop={onStop}
        isStreaming={isStreaming}
        disabled={serverStatus !== 'running'}
        model={model}
      />
    </div>
  )
}
