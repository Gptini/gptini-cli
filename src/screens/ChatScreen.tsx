import React, { useState, useEffect, useRef, useCallback, memo } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { getMessages } from '../api.js'
import { getToken, getWsUrl, getUser } from '../config.js'
import { useTheme } from '../context/ThemeContext.js'

interface Message {
  messageId: number
  senderId: number
  senderNickname: string
  content: string
  createdAt: string
}

interface TerminalSize {
  columns: number
  rows: number
}

interface Props {
  roomId: number
  roomName: string
  onBack: () => void
  terminalSize: TerminalSize
}

// ============================================
// ChatInput - 입력 영역 (독립적인 state 관리)
// ============================================
interface ChatInputProps {
  onSend: (message: string) => void
  onScrollUp: () => void
  onScrollDown: () => void
  onScrollTop: () => void
  onScrollBottom: () => void
  onBack: () => void
  canScroll: boolean
}

function ChatInput({ onSend, onScrollUp, onScrollDown, onScrollTop, onScrollBottom, onBack, canScroll }: ChatInputProps) {
  const { theme } = useTheme()
  const [input, setInput] = useState('')

  const handleSubmit = useCallback(() => {
    if (input.trim()) {
      onSend(input.trim())
      setInput('')
    }
  }, [input, onSend])

  useInput((inputChar, key) => {
    if (key.escape) {
      onBack()
      return
    }

    // 입력창이 비어있을 때만 스크롤 키 활성화
    if (input === '' && canScroll) {
      if (key.upArrow || inputChar === 'k') {
        onScrollUp()
      }
      if (key.downArrow || inputChar === 'j') {
        onScrollDown()
      }
      if (inputChar === 'g') {
        onScrollTop()
      }
      if (inputChar === 'G') {
        onScrollBottom()
      }
    }
  })

  return (
    <Box height={1} paddingX={1}>
      <Text color={theme.success}>❯ </Text>
      <TextInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        focus={true}
        placeholder="메시지를 입력하세요..."
      />
    </Box>
  )
}

// ============================================
// MessageList - 메시지 목록 (memo로 최적화)
// ============================================
interface MessageListProps {
  messages: Message[]
  visibleMessages: Message[]
  userId: number | undefined
  loading: boolean
  chatHeight: number
  scrollOffset: number
}

const MessageList = memo(function MessageList({
  messages,
  visibleMessages,
  userId,
  loading,
  chatHeight,
  scrollOffset
}: MessageListProps) {
  const { theme } = useTheme()

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  const maxScroll = Math.max(0, messages.length - chatHeight)
  const hasMoreAbove = scrollOffset < maxScroll
  const hasMoreBelow = scrollOffset > 0

  return (
    <>
      {/* 위로 더 있음 표시 */}
      {hasMoreAbove && (
        <Box justifyContent="center">
          <Text color={theme.textMuted}>↑ {maxScroll - scrollOffset}개 이전 메시지</Text>
        </Box>
      )}

      {/* 채팅 메시지 영역 */}
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {loading ? (
          <Text color={theme.textMuted}>메시지 로딩 중...</Text>
        ) : visibleMessages.length === 0 && messages.length === 0 ? (
          <Text color={theme.textMuted}>메시지가 없습니다. 첫 메시지를 보내보세요!</Text>
        ) : (
          visibleMessages.map((msg) => {
            const isMe = msg.senderId === userId
            return (
              <Box key={msg.messageId} justifyContent={isMe ? 'flex-end' : 'flex-start'}>
                {isMe ? (
                  <Box>
                    <Text color={theme.textMuted}>{formatTime(msg.createdAt)} </Text>
                    <Text color={theme.myMessage}>◀ {msg.content}</Text>
                  </Box>
                ) : (
                  <Box>
                    <Text color={theme.otherMessage} bold>{msg.senderNickname}</Text>
                    <Text color={theme.otherMessage}>: {msg.content} </Text>
                    <Text color={theme.textMuted}>{formatTime(msg.createdAt)}</Text>
                  </Box>
                )}
              </Box>
            )
          })
        )}
      </Box>

      {/* 아래로 더 있음 표시 */}
      {hasMoreBelow && (
        <Box justifyContent="center">
          <Text color={theme.textMuted}>↓ {scrollOffset}개 최신 메시지</Text>
        </Box>
      )}
    </>
  )
})

// ============================================
// ChatHeader - 헤더 (memo로 최적화)
// ============================================
interface ChatHeaderProps {
  roomName: string
  connected: boolean
  separatorLine: string
}

const ChatHeader = memo(function ChatHeader({ roomName, connected, separatorLine }: ChatHeaderProps) {
  const { theme } = useTheme()

  return (
    <>
      <Box height={1} justifyContent="space-between" paddingX={1}>
        <Text bold color={theme.primary}>📍 {roomName}</Text>
        <Text color={connected ? theme.success : theme.warning}>
          {connected ? '● 연결됨' : '○ 연결 중...'}
        </Text>
      </Box>
      <Box height={1} paddingX={1} justifyContent="space-between">
        <Text color={theme.border}>{separatorLine}</Text>
      </Box>
    </>
  )
})

// ============================================
// ChatFooter - 하단 도움말 (memo로 최적화)
// ============================================
interface ChatFooterProps {
  messageCount: number
  separatorLine: string
}

const ChatFooter = memo(function ChatFooter({ messageCount, separatorLine }: ChatFooterProps) {
  const { theme } = useTheme()

  return (
    <>
      <Box height={1} paddingX={1}>
        <Text color={theme.border}>{separatorLine}</Text>
      </Box>
      <Box height={1} paddingX={1} justifyContent="space-between">
        <Text color={theme.textMuted}>
          Enter:전송 | ESC:뒤로 | ↑k:위로 | ↓j:아래로 | g:맨위 | G:맨아래
        </Text>
        <Text color={theme.textMuted}>
          [{messageCount}개 메시지]
        </Text>
      </Box>
    </>
  )
})

// ============================================
// ChatScreen - 메인 컴포넌트
// ============================================
export default function ChatScreen({ roomId, roomName, onBack, terminalSize }: Props) {
  const { theme } = useTheme()
  const [messages, setMessages] = useState<Message[]>([])
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [scrollOffset, setScrollOffset] = useState(0)
  const clientRef = useRef<Client | null>(null)

  // 읽음 처리용 ref
  const lastSentReadIdRef = useRef<number | null>(null)
  const pendingReadIdRef = useRef<number | null>(null)
  const readTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialLoadRef = useRef(true)

  const userRef = useRef(getUser())
  const { userId } = userRef.current

  const { rows, columns } = terminalSize

  // 레이아웃 계산
  const headerHeight = 1
  const separatorHeight = 1
  const inputHeight = 1
  const helpHeight = 1
  const paddingHeight = 2
  const chatHeight = Math.max(5, rows - headerHeight - separatorHeight * 2 - inputHeight - helpHeight - paddingHeight)

  // 구분선 생성
  const separatorLine = '─'.repeat(Math.max(0, columns - 2))

  // 읽음 처리 전송 함수
  const flushRead = useCallback(() => {
    const messageId = pendingReadIdRef.current

    if (readTimerRef.current) {
      clearTimeout(readTimerRef.current)
      readTimerRef.current = null
    }

    if (messageId === null) return
    if (messageId === lastSentReadIdRef.current) return
    if (!clientRef.current?.connected) return

    clientRef.current.publish({
      destination: `/pub/chat/rooms/${roomId}/read`,
      body: JSON.stringify({ messageId })
    })

    lastSentReadIdRef.current = messageId
    pendingReadIdRef.current = null
  }, [roomId])

  // 읽음 처리 스케줄링 (throttle)
  const scheduleReadFlush = useCallback((messageId: number) => {
    pendingReadIdRef.current = messageId
    if (readTimerRef.current) return

    readTimerRef.current = setTimeout(() => {
      flushRead()
    }, 300)
  }, [flushRead])

  useEffect(() => {
    isInitialLoadRef.current = true
    loadMessages()
    connectWebSocket()

    return () => {
      if (readTimerRef.current) {
        clearTimeout(readTimerRef.current)
        readTimerRef.current = null
      }
      if (pendingReadIdRef.current !== null && pendingReadIdRef.current !== lastSentReadIdRef.current) {
        if (clientRef.current?.connected) {
          clientRef.current.publish({
            destination: `/pub/chat/rooms/${roomId}/read`,
            body: JSON.stringify({ messageId: pendingReadIdRef.current })
          })
        }
      }

      if (clientRef.current) {
        clientRef.current.deactivate()
      }
    }
  }, [roomId])

  const loadMessages = async () => {
    try {
      const data = await getMessages(roomId)
      setMessages(data)
      setLoading(false)

      if (data.length > 0) {
        const lastMsg = data[data.length - 1]
        pendingReadIdRef.current = lastMsg.messageId
      }
    } catch (err) {
      setLoading(false)
    }
  }

  const connectWebSocket = () => {
    const token = getToken()
    const wsUrl = getWsUrl()

    const client = new Client({
      webSocketFactory: () => {
        return new SockJS(wsUrl) as any
      },
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true)

        client.subscribe(`/sub/chat/rooms/${roomId}`, (message) => {
          try {
            const msg = JSON.parse(message.body)
            setMessages((prev) => [...prev, msg])
            scheduleReadFlush(msg.messageId)
          } catch (e) {
            // ignore parse error
          }
        })

        if (pendingReadIdRef.current !== null) {
          flushRead()
        }
      },
      onDisconnect: () => {
        setConnected(false)
      },
      onStompError: (frame) => {
        // STOMP error
      }
    })

    clientRef.current = client
    client.activate()
  }

  // 메시지 전송 (ChatInput에서 호출)
  const handleSendMessage = useCallback((content: string) => {
    if (!clientRef.current?.connected) return

    clientRef.current.publish({
      destination: `/pub/chat/rooms/${roomId}`,
      body: JSON.stringify({
        type: 'TEXT',
        content
      })
    })

    setScrollOffset(0)
  }, [roomId])

  // 스크롤 핸들러
  const maxScroll = Math.max(0, messages.length - chatHeight)

  const handleScrollUp = useCallback(() => {
    setScrollOffset(prev => Math.min(prev + 1, maxScroll))
  }, [maxScroll])

  const handleScrollDown = useCallback(() => {
    setScrollOffset(prev => Math.max(prev - 1, 0))
  }, [])

  const handleScrollTop = useCallback(() => {
    setScrollOffset(maxScroll)
  }, [maxScroll])

  const handleScrollBottom = useCallback(() => {
    setScrollOffset(0)
  }, [])

  // 표시할 메시지 계산
  const startIndex = Math.max(0, messages.length - chatHeight - scrollOffset)
  const endIndex = messages.length - scrollOffset
  const visibleMessages = messages.slice(startIndex, endIndex)

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      <ChatHeader
        roomName={roomName}
        connected={connected}
        separatorLine={separatorLine}
      />

      <MessageList
        messages={messages}
        visibleMessages={visibleMessages}
        userId={userId}
        loading={loading}
        chatHeight={chatHeight}
        scrollOffset={scrollOffset}
      />

      <ChatFooter
        messageCount={messages.length}
        separatorLine={separatorLine}
      />

      <ChatInput
        onSend={handleSendMessage}
        onScrollUp={handleScrollUp}
        onScrollDown={handleScrollDown}
        onScrollTop={handleScrollTop}
        onScrollBottom={handleScrollBottom}
        onBack={onBack}
        canScroll={messages.length > chatHeight}
      />
    </Box>
  )
}
