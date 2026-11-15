import { Plus, Settings2 } from 'lucide-react'
import { ModelId, ModelStates } from '../api'

interface TitlebarProps {
  serverStatus: string
  onNewChat: () => void
  onToggleSettings: () => void
  model: ModelId
  models: ModelStates
  onModelChange: (model: ModelId) => void
  busy: boolean
  title: string
}

export function Titlebar({ serverStatus, onNewChat, onToggleSettings, model, models, onModelChange, busy, title }: TitlebarProps) {
  return (
    <header className="titlebar">
      <div className="titlebar-heading" title={title}>{title}</div>
      <div className="titlebar-actions">
        <span className={`server-indicator ${serverStatus}`} title={serverStatus === 'running' ? 'Model ready' : 'Model is not ready'} aria-label={serverStatus === 'running' ? 'Model ready' : 'Model is not ready'} />
        <div className="model-switch" role="group" aria-label="Choose model">
          <button className={model === 'system' ? 'selected' : ''} onClick={() => onModelChange('system')} disabled={busy} aria-pressed={model === 'system'}>On device</button>
          <span title={models.pcc.reason || 'Private Cloud Compute uses Apple servers and may have a daily limit'}><button className={model === 'pcc' ? 'selected' : ''} onClick={() => onModelChange('pcc')} disabled={busy || !models.pcc.available || serverStatus !== 'running'} aria-label={models.pcc.available ? 'Use Private Cloud Compute' : `Private Cloud Compute unavailable: ${models.pcc.reason}`} aria-pressed={model === 'pcc'}>Private Cloud</button></span>
        </div>
        <button className="titlebar-btn" onClick={onToggleSettings} title="System instructions" aria-label="Open system instructions"><Settings2 size={18} /></button>
        <button className="titlebar-btn titlebar-new" onClick={onNewChat} disabled={busy} title="New chat" aria-label="Start a new chat"><Plus size={19} /></button>
      </div>
    </header>
  )
}
