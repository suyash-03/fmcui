/// <reference types="vite/client" />

interface Window {
  fmAPI?: {
    getChats: () => Promise<any[]>
    saveChat: (chat: any) => Promise<void>
    deleteChat: (id: string) => Promise<void>
    getServerStatus: () => Promise<string>
    getServerPort: () => Promise<number | null>
    getModels: () => Promise<Record<'system' | 'pcc', { available: boolean; reason?: string }>>
    onModelsChange: (callback: (models: Record<'system' | 'pcc', { available: boolean; reason?: string }>) => void) => () => void
    restartServer: () => Promise<{ port: number | null; status: string }>
    onServerStatusChange: (callback: (status: string) => void) => () => void
    streamChat: (
      messages: Array<{ role: string; content: string }>,
      model: 'system' | 'pcc',
      callbacks: {
        onToken: (token: string) => void
        onDone: () => void
        onError: (error: string) => void
      }
    ) => () => void
  }
}
