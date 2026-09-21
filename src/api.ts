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

// ── Streaming Chat Completions Client ────────────────────────────────
// Talks to fm serve's OpenAI-compatible /v1/chat/completions endpoint.
// Yields content tokens as they arrive.

export async function* streamChat(
  port: number,
  messages: ChatMessage[],
  signal?: AbortSignal
): AsyncGenerator<string> {
  // If running in Electron, use the IPC bridge to avoid CORS/CSRF
  if (window.fmAPI && window.fmAPI.streamChat) {
    let resolveNext: ((value: IteratorResult<string>) => void) | null = null
    let rejectNext: ((reason?: any) => void) | null = null
    const buffer: string[] = []
    let isDone = false
    let currentError: Error | null = null

    const cleanup = window.fmAPI.streamChat(
      messages,
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
          if (rejectNext) {
            rejectNext(currentError)
            rejectNext = null
          }
        },
      }
    )

    // Handle abort signal
    if (signal) {
      signal.addEventListener('abort', () => {
        cleanup()
        if (rejectNext) {
          rejectNext(new Error('AbortError'))
        }
      })
    }

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
            rejectNext = reject
          })
          if (nextVal.done) break
          yield nextVal.value
        }
      }
    } finally {
      cleanup()
    }
    return
  }

  // ── Fallback for browser dev mode (via Vite proxy) ──────────────────
  const response = await fetch(`/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'system',
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
