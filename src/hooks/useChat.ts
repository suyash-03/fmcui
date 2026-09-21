import { useState, useCallback, useRef, useEffect } from 'react'
import { ChatMessage, ChatSession, streamChat } from '../api'

export function useChat(serverPort: number | null) {
  const [chats, setChats] = useState<ChatSession[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Use a ref to always have fresh messages inside sendMessage
  const messagesRef = useRef<ChatMessage[]>([])
  messagesRef.current = messages

  // Load chats on mount
  useEffect(() => {
    if (window.fmAPI) {
      window.fmAPI.getChats().then(loaded => {
        setChats(loaded)
        if (loaded.length > 0) {
          setActiveChatId(loaded[0].id)
          setMessages(loaded[0].messages)
        }
      })
    }
  }, [])

  const selectChat = useCallback((id: string) => {
    const chat = chats.find(c => c.id === id)
    if (chat) {
      setActiveChatId(id)
      setMessages(chat.messages)
      setError(null)
    }
  }, [chats])

  const newChat = useCallback(() => {
    setActiveChatId(null)
    setMessages([])
    setError(null)
  }, [])

  const deleteChat = useCallback(async (id: string) => {
    if (window.fmAPI) {
      await window.fmAPI.deleteChat(id)
      setChats(prev => prev.filter(c => c.id !== id))
      if (activeChatId === id) {
        newChat()
      }
    }
  }, [activeChatId, newChat])

  const syncChatToDisk = async (newMessages: ChatMessage[]) => {
    if (!window.fmAPI) return
    
    // Generate an ID if this is a new chat
    const id = activeChatId || crypto.randomUUID()
    
    // Find existing to preserve title if it exists
    const existing = chats.find(c => c.id === id)
    
    const session: ChatSession = {
      id,
      title: existing?.title || '',
      messages: newMessages,
      updatedAt: Date.now()
    }
    
    await window.fmAPI.saveChat(session)
    
    // Reload chats to get the updated list and title
    const updatedChats = await window.fmAPI.getChats()
    setChats(updatedChats)
    
    if (!activeChatId) {
      setActiveChatId(id)
    }
  }

  const sendMessage = useCallback(
    async (content: string, systemInstructions?: string) => {
      if (!serverPort) return

      const userMessage: ChatMessage = { role: 'user', content }
      const history = [...messagesRef.current, userMessage]

      setMessages([...history, { role: 'assistant', content: '' }])
      setIsStreaming(true)
      setError(null)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const apiMessages: ChatMessage[] = []
        if (systemInstructions) {
          apiMessages.push({ role: 'system', content: systemInstructions })
        }
        apiMessages.push(...history)

        let accumulated = ''
        for await (const token of streamChat(serverPort, apiMessages, controller.signal)) {
          accumulated += token
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: accumulated }
            return updated
          })
        }
        
        // Sync to disk once complete
        const finalMessages = [...history, { role: 'assistant' as const, content: accumulated }]
        await syncChatToDisk(finalMessages)

      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Failed to get response')
          setMessages(prev => {
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant' && !last.content) {
              return prev.slice(0, -1)
            }
            return prev
          })
        }
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [serverPort, activeChatId, chats]
  )

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
    // Sync whatever was generated so far
    if (messagesRef.current.length > 0) {
      syncChatToDisk(messagesRef.current)
    }
  }, [])

  return { 
    chats,
    activeChatId,
    messages, 
    isStreaming, 
    error, 
    sendMessage, 
    stopGeneration, 
    selectChat,
    newChat,
    deleteChat
  }
}
