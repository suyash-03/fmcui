import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { spawn, ChildProcess, execSync } from 'child_process'
import * as path from 'path'
import * as net from 'net'
import * as os from 'os'
import { initStoreIpc } from './store'

app.setName('fmcui')

let mainWindow: BrowserWindow | null = null
let fmProcess: ChildProcess | null = null
let serverPort: number | null = null
let serverStatus: 'starting' | 'running' | 'error' | 'not-found' = 'starting'
type ModelId = 'system' | 'pcc'
type ModelState = { available: boolean; reason?: string }
let modelStates: Record<ModelId, ModelState> = {
  system: { available: true },
  pcc: { available: false, reason: 'Private Cloud Compute is not available from this fm installation.' },
}
const activeRequests = new Map<string, AbortController>()

async function refreshModels(port: number): Promise<void> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/models`)
    if (!response.ok) return
    const payload = await response.json() as { data?: Array<{ id: string; available?: boolean; reason?: string }>; models?: Array<{ id?: string; name?: string; available?: boolean; reason?: string }> }
    const models = payload.data ?? payload.models ?? []
    const pcc = models.find(model => (model.id ?? ('name' in model ? model.name : undefined)) === 'pcc')
    modelStates = {
      system: { available: true },
      pcc: pcc ? { available: pcc.available !== false, reason: pcc.reason } : {
        available: false,
        reason: 'This version of fm does not offer Private Cloud Compute. It may also require Apple eligibility and access.',
      },
    }
    mainWindow?.webContents.send('models-changed', modelStates)
  } catch (error) {
    console.error('[fm-chat] Could not read available models:', error)
  }
}

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
  modelStates.pcc = { available: false, reason: 'Checking Private Cloud Compute availability…' }
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
      await refreshModels(serverPort)
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
  activeRequests.forEach(controller => controller.abort())
  activeRequests.clear()
  if (fmProcess) {
    const processToStop = fmProcess
    console.log('[fm-chat] Stopping fm serve...')
    processToStop.kill('SIGTERM')
    const forceKillTimer = setTimeout(() => {
      if (processToStop.exitCode === null) {
        console.log('[fm-chat] Force killing fm serve...')
        processToStop.kill('SIGKILL')
      }
    }, 5000)
    processToStop.on('exit', () => clearTimeout(forceKillTimer))
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
    backgroundColor: '#FFFFFF',
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
    // mainWindow?.webContents.openDevTools()
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
ipcMain.handle('get-models', () => modelStates)
ipcMain.handle('restart-server', async () => {
  stopFmServe()
  await startFmServe()
  return { port: serverPort, status: serverStatus }
})

// Proxy chat completions through main process (avoids CORS/CSRF).
// The renderer sends messages via IPC, main process calls fm serve
// from Node.js (no browser restrictions), and streams tokens back
// to the renderer via event-based IPC.
ipcMain.on('chat-stream', async (event, { messages, requestId, model }) => {
  if (!serverPort) {
    event.sender.send('chat-stream-error', { requestId, error: 'Server not running' })
    return
  }
  if ((model !== 'system' && model !== 'pcc') || !modelStates[model as ModelId].available) {
    event.sender.send('chat-stream-error', { requestId, error: 'That model is not available. Choose the on-device model.' })
    return
  }

  const controller = new AbortController()
  activeRequests.set(requestId, controller)

  try {
    const response = await fetch(`http://127.0.0.1:${serverPort}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      event.sender.send('chat-stream-error', {
        requestId,
        error: model === 'pcc' && response.status === 429
          ? 'Private Cloud Compute has reached its request limit. Choose On device or try again when the limit resets.'
          : `Model error (${response.status}): ${text || response.statusText}`,
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
    if (!controller.signal.aborted) {
      event.sender.send('chat-stream-error', {
        requestId,
        error: err.message || 'Failed to fetch',
      })
    }
  } finally {
    activeRequests.delete(requestId)
  }
})

ipcMain.on('chat-stream-cancel', (_event, requestId: string) => {
  activeRequests.get(requestId)?.abort()
})

// ── App Lifecycle ───────────────────────────────────────────────────
app.whenReady().then(async () => {
  // macOS 27 (Golden Gate) required for Apple Foundation Models
  const darwinVersion = parseInt(os.release().split('.')[0], 10)
  // macOS 27 uses Darwin 26. Checking Darwin 27 rejected supported Macs.
  if (darwinVersion < 26) {
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
