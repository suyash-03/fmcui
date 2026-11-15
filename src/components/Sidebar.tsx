import { MessageSquare, Plus, Trash2 } from 'lucide-react'
import { ChatSession } from '../api'

interface SidebarProps {
  chats: ChatSession[]
  activeChatId: string | null
  onSelectChat: (id: string) => void
  onDeleteChat: (id: string) => void
  onNewChat: () => void
  busy: boolean
}

export function Sidebar({ chats, activeChatId, onSelectChat, onDeleteChat, onNewChat, busy }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Chat history">
      <div className="sidebar-header"><span className="sidebar-brand"><span>f</span><span className="brand-rest">mcui</span></span></div>
      <div className="sidebar-content">
        <button className="sidebar-new" onClick={onNewChat} disabled={busy}><Plus size={17} /> New chat</button>
        <div className="sidebar-section-title">Recent chats</div>
        {chats.length === 0 && <p className="sidebar-empty">Your conversations will appear here.</p>}
        {chats.map(chat => (
          <div key={chat.id} className={`chat-list-item ${chat.id === activeChatId ? 'active' : ''}`}>
            <button className="chat-list-select" onClick={() => onSelectChat(chat.id)} title={chat.title || 'New chat'} disabled={busy}>
              <MessageSquare size={15} aria-hidden="true" />
              <span className="chat-list-title">{chat.title || 'New chat'}</span>
            </button>
            <button className="chat-list-delete" onClick={() => onDeleteChat(chat.id)} title="Delete chat" aria-label={`Delete ${chat.title || 'chat'}`} disabled={busy}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <div className="sidebar-footer"><span className="privacy-dot" /> Chats saved on this Mac</div>
    </aside>
  )
}
