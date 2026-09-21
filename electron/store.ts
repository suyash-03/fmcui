import { app, ipcMain } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'

export interface ChatSession {
  id: string
  title: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  updatedAt: number
}

const getStorePath = () => path.join(app.getPath('userData'), 'chats.json')

export async function getChats(): Promise<ChatSession[]> {
  try {
    const data = await fs.readFile(getStorePath(), 'utf-8')
    return JSON.parse(data)
  } catch (error: any) {
    if (error.code === 'ENOENT') return []
    console.error('Failed to read chats:', error)
    return []
  }
}

export async function saveChat(chat: ChatSession): Promise<void> {
  const chats = await getChats()
  const index = chats.findIndex(c => c.id === chat.id)
  
  // Set title to first user message if it's empty
  if (!chat.title && chat.messages.length > 0) {
    const firstUser = chat.messages.find(m => m.role === 'user')
    if (firstUser) {
      chat.title = firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? '...' : '')
    } else {
      chat.title = 'New Chat'
    }
  }

  if (index !== -1) {
    chats[index] = chat
  } else {
    chats.unshift(chat)
  }

  // Sort by updatedAt descending
  chats.sort((a, b) => b.updatedAt - a.updatedAt)

  await fs.writeFile(getStorePath(), JSON.stringify(chats, null, 2))
}

export async function deleteChat(id: string): Promise<void> {
  const chats = await getChats()
  const filtered = chats.filter(c => c.id !== id)
  await fs.writeFile(getStorePath(), JSON.stringify(filtered, null, 2))
}

export function initStoreIpc() {
  ipcMain.handle('get-chats', async () => await getChats())
  ipcMain.handle('save-chat', async (_, chat) => await saveChat(chat))
  ipcMain.handle('delete-chat', async (_, id) => await deleteChat(id))
}
