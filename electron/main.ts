import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { spawn, ChildProcess, execSync } from 'child_process'
import * as path from 'path'
import * as net from 'net'
import * as os from 'os'
import { initStoreIpc } from './store'

let mainWindow: BrowserWindow | null = null
let fmProcess: ChildProcess | null = null
let serverPort: number | null = null
let serverStatus: 'starting' | 'running' | 'error' | 'not-found' = 'starting'

// ── Port Discovery ──────────────────────────────────────────────────
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as net.AddressInfo
      const port = address.port
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

// ── Health Check ────────────────────────────────────────────────────
async function waitForHealth(port: number, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`)
      if (res.ok) return true
    } catch {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 1000))
  }
  return false
}

// ── Check if fm CLI exists ──────────────────────────────────────────
function isFmAvailable(): boolean {
  try {
    execSync('/usr/bin/fm available', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

// ── Start fm serve ──────────────────────────────────────────────────
async function startFmServe(): Promise<void> {
  if (!isFmAvailable()) {
    serverStatus = 'not-found'
    notifyRenderer()
    return
  }

  try {
    serverPort = await findFreePort()
    serverStatus = 'starting'
    notifyRenderer()

    console.log(`[fm-chat] Starting fm serve on port ${serverPort}...`)

    fmProcess = spawn('/usr/bin/fm', ['serve', '--port', String(serverPort)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    fmProcess.stdout?.on('data', (data: Buffer) => {
      console.log(`[fm serve] ${data.toString().trim()}`)
    })

    fmProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[fm serve] ${data.toString().trim()}`)
    })

    fmProcess.on('error', (err: Error) => {
      console.error('[fm-chat] Failed to start fm serve:', err.message)
      serverStatus = 'not-found'
      notifyRenderer()
    })

    fmProcess.on('exit', (code: number | null, signal: string | null) => {
      console.log(`[fm-chat] fm serve exited (code: ${code}, signal: ${signal})`)
      if (serverStatus === 'running') {
        serverStatus = 'error'
        notifyRenderer()
      }
      fmProcess = null
    })

    const healthy = await waitForHealth(serverPort)
    if (healthy) {
      console.log(`[fm-chat] fm serve is healthy on port ${serverPort}`)
      serverStatus = 'running'
    } else {
      console.error('[fm-chat] fm serve health check timed out')
      serverStatus = 'error'
    }
    notifyRenderer()
  } catch (err: any) {
    console.error('[fm-chat] Error starting fm serve:', err.message)
    serverStatus = 'error'
    notifyRenderer()
  }
}

// ── Stop fm serve ───────────────────────────────────────────────────
function stopFmServe(): void {
  if (fmProcess) {
    console.log('[fm-chat] Stopping fm serve...')
    fmProcess.kill('SIGTERM')
    const forceKillTimer = setTimeout(() => {
      if (fmProcess && !fmProcess.killed) {
        console.log('[fm-chat] Force killing fm serve...')
        fmProcess.kill('SIGKILL')
      }
    }, 5000)
    fmProcess.on('exit', () => clearTimeout(forceKillTimer))
    fmProcess = null
  }
}

// ── Notify Renderer ─────────────────────────────────────────────────
function notifyRenderer(): void {
  mainWindow?.webContents.send('server-status-changed', serverStatus)
}

// ── Create Window ───────────────────────────────────────────────────
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 700,
    minHeight: 450,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 13 },
    vibrancy: 'sidebar', // Native macOS liquid glass effect
    visualEffectState: 'followWindow',
    backgroundColor: '#00000000', // Fully transparent to let vibrancy show through
    transparent: true,
    icon: path.join(__dirname, process.env.VITE_DEV_SERVER_URL ? '../public/icon.png' : '../dist/icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.webContents.openDevTools()
  })

  // Forward renderer console logs to the main terminal
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer]: ${message} (${sourceId}:${line})`)
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ── IPC Handlers ────────────────────────────────────────────────────
ipcMain.handle('get-server-port', () => serverPort)
ipcMain.handle('get-server-status', () => serverStatus)
ipcMain.handle('restart-server', async () => {
  stopFmServe()
  await startFmServe()
  return { port: serverPort, status: serverStatus }
})

// Proxy chat completions through main process (avoids CORS/CSRF).
// The renderer sends messages via IPC, main process calls fm serve
// from Node.js (no browser restrictions), and streams tokens back
// to the renderer via event-based IPC.
ipcMain.on('chat-stream', async (event, { messages, requestId }) => {
  if (!serverPort) {
    event.sender.send('chat-stream-error', { requestId, error: 'Server not running' })
    return
  }

  try {
    const response = await fetch(`http://127.0.0.1:${serverPort}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'system',
        messages,
        stream: true,
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      event.sender.send('chat-stream-error', {
        requestId,
        error: `Model error (${response.status}): ${text || response.statusText}`,
      })
      return
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6))
            const content = json.choices?.[0]?.delta?.content
            if (content) {
              event.sender.send('chat-stream-token', { requestId, token: content })
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }

    event.sender.send('chat-stream-done', { requestId })
  } catch (err: any) {
    event.sender.send('chat-stream-error', {
      requestId,
      error: err.message || 'Failed to fetch',
    })
  }
})

// ── App Lifecycle ───────────────────────────────────────────────────
app.whenReady().then(async () => {
  // macOS 27 (Golden Gate) required for Apple Foundation Models
  const darwinVersion = parseInt(os.release().split('.')[0], 10)
  if (darwinVersion < 27) {
    dialog.showErrorBox(
      'macOS Update Required',
      'FM Chat requires macOS 27 (Golden Gate) or later to use Apple Foundation Models on-device.'
    )
    app.quit()
    return
  }

  if (process.platform === 'darwin') {
    app.dock.setIcon(path.join(__dirname, process.env.VITE_DEV_SERVER_URL ? '../public/icon.png' : '../dist/icon.png'))
  }

  initStoreIpc()
  createWindow()
  await startFmServe()
})

app.on('window-all-closed', () => {
  stopFmServe()
  app.quit()
})

app.on('before-quit', () => {
  stopFmServe()
})
