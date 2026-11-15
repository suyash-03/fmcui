import { lazy, Suspense } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChatMessage } from '../api'

import { Sparkles } from 'lucide-react'

const CodeBlock = lazy(() => import('./CodeBlock').then(module => ({ default: module.CodeBlock })))

interface MessageBubbleProps {
  message: ChatMessage
  isStreaming: boolean
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="message message-user">
        <div className="message-user-stack"><span className="message-label">You</span><div className="message-user-content">{message.content}</div></div>
      </div>
    )
  }

  return (
    <div className="message message-assistant">
      <div className="message-assistant-avatar">
        <Sparkles size={18} />
      </div>
      <div className="message-assistant-stack"><span className="message-label">Foundation Models</span><div className="message-assistant-content">
        {message.content ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Block code: override <pre> to pass through, and let <code>
              // handle rendering via CodeBlock
              pre({ children }) {
                return <>{children}</>
              },
              code({ className, children }) {
                const match = /language-(\w+)/.exec(className || '')
                const codeStr = String(children).replace(/\n$/, '')

                // Block code: has a language class OR contains newlines
                if (match || codeStr.includes('\n')) {
                  return (
                    <Suspense fallback={<pre className="code-loading">{codeStr}</pre>}>
                      <CodeBlock language={match?.[1] || ''} code={codeStr} />
                    </Suspense>
                  )
                }

                // Inline code
                return <code className={className}>{children}</code>
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        ) : null}
        {isStreaming && <span className="streaming-cursor" />}
      </div></div>
    </div>
  )
}
