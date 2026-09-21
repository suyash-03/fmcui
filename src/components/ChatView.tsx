import { useRef, useEffect } from 'react'
import { ChatMessage } from '../api'
import { MessageBubble } from './MessageBubble'
import { InputBar } from './InputBar'
import { Cpu, WifiOff, AlertCircle } from 'lucide-react'

interface ChatViewProps {
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
  serverStatus: string
  onSend: (content: string) => void
  onStop: () => void
  onRetry: () => void
}

const EXAMPLE_PROMPTS = [
  'Explain how Swift concurrency works with async/await',
  'What are the key differences between structs and classes?',
  'Write a SwiftUI view that displays a searchable list',
  'Summarize the benefits of on-device machine learning',
]

export function ChatView({
  messages,
  isStreaming,
  error,
  serverStatus,
  onSend,
  onStop,
  onRetry,
}: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
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
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
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
            you're running macOS 26 or later and have accepted the license agreement.
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
            <div className="empty-state-icon">
              <Cpu size={28} color="white" />
            </div>
            <h1 className="empty-state-title">Apple Foundation Models</h1>
            <p className="empty-state-subtitle">Running privately on your device</p>
            <div className="example-prompts">
              {EXAMPLE_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  className="example-prompt"
                  onClick={() => onSend(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="messages-inner">
            {error && (
              <div className="error-banner">
                <AlertCircle size={16} />
                <span>{error}</span>
                <button onClick={onRetry}>Retry</button>
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
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <InputBar
        onSend={onSend}
        onStop={onStop}
        isStreaming={isStreaming}
        disabled={serverStatus !== 'running'}
      />
    </div>
  )
}
