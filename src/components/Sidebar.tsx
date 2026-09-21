import { Trash2 } from 'lucide-react'
import { ChatSession } from '../api'

interface SidebarProps {
  chats: ChatSession[]
  activeChatId: string | null
  onSelectChat: (id: string) => void
  onDeleteChat: (id: string) => void
}

export function Sidebar({ chats, activeChatId, onSelectChat, onDeleteChat }: SidebarProps) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">Recent Chats</div>
      </div>
      <div className="sidebar-content">
        {chats.map(chat => (
          <div
            key={chat.id}
            className={`chat-list-item ${chat.id === activeChatId ? 'active' : ''}`}
            onClick={() => onSelectChat(chat.id)}
          >
            <div className="chat-list-title">{chat.title || 'New Chat'}</div>
            <button
              className="chat-list-delete"
              onClick={e => {
                e.stopPropagation()
                onDeleteChat(chat.id)
              }}
              title="Delete Chat"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {chats.length === 0 && (
          <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
            No recent chats
          </div>
        )}
      </div>
    </div>
  )
}
