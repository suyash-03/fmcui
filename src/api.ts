// ── Types ────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  updatedAt: number
}
export type ModelId = 'system' | 'pcc'
export type ModelState = { available: boolean; reason?: string }
export type ModelStates = Record<ModelId, ModelState>

// ── Streaming Chat Completions Client ────────────────────────────────
// Talks to fm serve's OpenAI-compatible /v1/chat/completions endpoint.
// Yields content tokens as they arrive.

export async function* streamChat(
  port: number,
  messages: ChatMessage[],
  model: ModelId,
  signal?: AbortSignal
): AsyncGenerator<string> {
  // If running in Electron, use the IPC bridge to avoid CORS/CSRF
  if (window.fmAPI && window.fmAPI.streamChat) {
    let resolveNext: ((value: IteratorResult<string>) => void) | null = null
    const buffer: string[] = []
    let isDone = false
    let currentError: Error | null = null
    let rejectPending: ((reason?: any) => void) | null = null
    const onAbort = () => {
      cleanup()
      currentError = new DOMException('Request stopped', 'AbortError')
      if (rejectPending) {
        rejectPending(currentError)
        rejectPending = null
      }
    }

    const cleanup = window.fmAPI.streamChat(
      messages,
      model,
      {
        onToken: (token) => {
          if (resolveNext) {
            resolveNext({ value: token, done: false })
            resolveNext = null
          } else {
            buffer.push(token)
          }
        },
        onDone: () => {
          isDone = true
          if (resolveNext) {
            resolveNext({ value: undefined, done: true })
            resolveNext = null
          }
        },
        onError: (errStr) => {
          currentError = new Error(errStr)
          if (rejectPending) {
            rejectPending(currentError)
            rejectPending = null
          }
        },
      }
    )

    // Handle abort signal
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) onAbort()

    try {
      while (true) {
        if (buffer.length > 0) {
          yield buffer.shift()!
        } else if (currentError) {
          throw currentError
        } else if (isDone) {
          break
        } else {
          // Wait for next event
          const nextVal = await new Promise<IteratorResult<string>>((resolve, reject) => {
            resolveNext = resolve
            rejectPending = reject
          })
          if (nextVal.done) break
          yield nextVal.value
        }
      }
    } finally {
      signal?.removeEventListener('abort', onAbort)
      cleanup()
    }
    return
  }

  // ── Fallback for browser dev mode (via Vite proxy) ──────────────────
  const response = await fetch(`/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
    signal,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Model error (${response.status}): ${text || response.statusText}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let accumulated = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    accumulated += decoder.decode(value, { stream: true })
    const lines = accumulated.split('\n')
    accumulated = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === 'data: [DONE]') continue
      if (trimmed.startsWith('data: ')) {
        try {
          const json = JSON.parse(trimmed.slice(6))
          const content = json.choices?.[0]?.delta?.content
          if (content) yield content
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  }
}
