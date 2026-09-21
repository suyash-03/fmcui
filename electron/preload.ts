import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('fmAPI', {
  getChats: (): Promise<any[]> => ipcRenderer.invoke('get-chats'),
  saveChat: (chat: any): Promise<void> => ipcRenderer.invoke('save-chat', chat),
  deleteChat: (id: string): Promise<void> => ipcRenderer.invoke('delete-chat', id),

  getServerPort: (): Promise<number | null> =>
    ipcRenderer.invoke('get-server-port'),

  getServerStatus: (): Promise<string> =>
    ipcRenderer.invoke('get-server-status'),

  restartServer: (): Promise<{ port: number | null; status: string }> =>
    ipcRenderer.invoke('restart-server'),

  onServerStatusChange: (callback: (status: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: string) => callback(status)
    ipcRenderer.on('server-status-changed', handler)
    return () => {
      ipcRenderer.removeListener('server-status-changed', handler)
    }
  },

  // Stream chat completions via main process (bypasses CORS/CSRF)
  streamChat: (
    messages: Array<{ role: string; content: string }>,
    callbacks: {
      onToken: (token: string) => void
      onDone: () => void
      onError: (error: string) => void
    }
  ): (() => void) => {
    const requestId = crypto.randomUUID()

    const tokenHandler = (_e: Electron.IpcRendererEvent, data: { requestId: string; token: string }) => {
      if (data.requestId === requestId) callbacks.onToken(data.token)
    }
    const doneHandler = (_e: Electron.IpcRendererEvent, data: { requestId: string }) => {
      if (data.requestId === requestId) {
        cleanup()
        callbacks.onDone()
      }
    }
    const errorHandler = (_e: Electron.IpcRendererEvent, data: { requestId: string; error: string }) => {
      if (data.requestId === requestId) {
        cleanup()
        callbacks.onError(data.error)
      }
    }

    ipcRenderer.on('chat-stream-token', tokenHandler)
    ipcRenderer.on('chat-stream-done', doneHandler)
    ipcRenderer.on('chat-stream-error', errorHandler)

    // Send the request
    ipcRenderer.send('chat-stream', { messages, requestId })

    // Return cleanup/abort function
    const cleanup = () => {
      ipcRenderer.removeListener('chat-stream-token', tokenHandler)
      ipcRenderer.removeListener('chat-stream-done', doneHandler)
      ipcRenderer.removeListener('chat-stream-error', errorHandler)
    }

    return cleanup
  },
})
