export {}

declare global {
  interface Window {
    fmAPI?: {
      getServerPort: () => Promise<number>
      getServerStatus: () => Promise<string>
      restartServer: () => Promise<{ port: number; status: string }>
      onServerStatusChange: (callback: (status: string) => void) => () => void
    }
  }
}
