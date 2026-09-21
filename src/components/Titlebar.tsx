import { Plus, Settings } from 'lucide-react'

interface TitlebarProps {
  serverStatus: string
  onNewChat: () => void
  onToggleSettings: () => void
}

export function Titlebar({ serverStatus, onNewChat, onToggleSettings }: TitlebarProps) {
  const statusLabel: Record<string, string> = {
    starting: 'Starting model…',
    running: 'On-device model',
    error: 'Connection error',
    'not-found': 'fm not found',
  }

  return (
    <header className="titlebar">
      <span className="titlebar-title">FM Chat</span>

      <div className="titlebar-status">
        <span className={`titlebar-status-dot ${serverStatus}`} />
        <span>{statusLabel[serverStatus] ?? 'Unknown'}</span>
      </div>

      <div className="titlebar-actions">
        <button
          className="titlebar-btn"
          onClick={onToggleSettings}
          title="System Instructions"
          aria-label="Open system instructions"
        >
          <Settings size={16} />
        </button>
        <button
          className="titlebar-btn"
          onClick={onNewChat}
          title="New Chat"
          aria-label="Start a new chat"
        >
          <Plus size={16} />
        </button>
      </div>
    </header>
  )
}
