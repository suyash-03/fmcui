import { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react'
import { ArrowUp, Square } from 'lucide-react'

interface InputBarProps {
  onSend: (content: string) => void
  onStop: () => void
  isStreaming: boolean
  disabled: boolean
}

export function InputBar({ onSend, onStop, isStreaming, disabled }: InputBarProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea to fit content
  const autoResize = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
    }
  }, [])

  useEffect(() => {
    autoResize()
  }, [value, autoResize])

  // Focus textarea on mount and when streaming ends
  useEffect(() => {
    if (!isStreaming && !disabled) {
      textareaRef.current?.focus()
    }
  }, [isStreaming, disabled])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isStreaming || disabled) return
    onSend(trimmed)
    setValue('')
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, isStreaming, disabled, onSend])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  return (
    <div className="input-bar-container">
      <div className="input-bar">
        <div className="input-bar-inner">
          <textarea
            ref={textareaRef}
            className="input-textarea"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything…"
            rows={1}
            disabled={disabled}
            aria-label="Message input"
          />
          {isStreaming ? (
            <button
              className="input-stop-btn"
              onClick={onStop}
              title="Stop generating (Esc)"
              aria-label="Stop generating"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              className="input-send-btn"
              onClick={handleSend}
              disabled={!value.trim() || disabled}
              title="Send message (Enter)"
              aria-label="Send message"
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          )}
        </div>
        <p className="input-hint">
          Apple Foundation Model · Running on-device · Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
