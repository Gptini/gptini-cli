import React, { useState, useEffect, useRef, useCallback, memo } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { getMessages } from '../api.js'
import { getUser } from '../config.js'
import { useTheme } from '../context/ThemeContext.js'
import { useChatStore, type ChatMessage } from '../stores/chatStore.js'

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
  onScrollBottom: () => void
  onBack: () => void
  canScroll: boolean
}

function ChatInput({ onSend, onScrollUp, onScrollDown, onScrollBottom, onBack, canScroll }: ChatInputProps) {
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
  messages: ChatMessage[]
  visibleMessages: ChatMessage[]
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
            const content = msg.content || ''
            return (
              <Box key={msg.messageId} justifyContent={isMe ? 'flex-end' : 'flex-start'}>
                {isMe ? (
                  <Box>
                    <Text color={theme.textMuted}>{formatTime(msg.createdAt)} </Text>
                    <Text color={theme.myMessage}>◀ {content}</Text>
                  </Box>
                ) : (
                  <Box>
                    <Text color={theme.otherMessage} bold>{msg.senderNickname}</Text>
                    <Text color={theme.otherMessage}>: {content} </Text>
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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [scrollOffset, setScrollOffset] = useState(0)

  const userRef = useRef(getUser())
  const { userId } = userRef.current

  // WebSocket store
  const {
    isConnected,
    subscribeToRoom,
    subscribeToReadStatus,
    unsubscribeFromRoom,
    sendMessage,
    scheduleReadFlush,
    flushRead,
  } = useChatStore()

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

  // 초기 읽음 처리를 위한 ref
  const initialReadSentRef = useRef(false)
  const lastMessageIdRef = useRef<number | null>(null)

  // 메시지 로드 및 구독 설정
  useEffect(() => {
    initialReadSentRef.current = false
    loadMessages()

    return () => {
      // 방 나갈 때 구독 해제 및 읽음 처리 flush
      if (lastMessageIdRef.current !== null) {
        flushRead(roomId)
      }
      unsubscribeFromRoom(roomId)
    }
  }, [roomId])

  // 연결되면 구독 시작
  useEffect(() => {
    if (!isConnected) return

    // 메시지 구독
    subscribeToRoom(roomId, (message: ChatMessage) => {
      setMessages((prev) => [...prev, message])
      scheduleReadFlush(roomId, message.messageId)
      lastMessageIdRef.current = message.messageId
    })

    // 읽음 상태 구독
    subscribeToReadStatus(roomId)

    // 초기 읽음 처리
    if (!initialReadSentRef.current && lastMessageIdRef.current !== null) {
      flushRead(roomId)
      initialReadSentRef.current = true
    }
  }, [isConnected, roomId])

  const loadMessages = async () => {
    try {
      const data = await getMessages(roomId)
      setMessages(data)
      setLoading(false)

      if (data.length > 0) {
        const lastMsg = data[data.length - 1]
        lastMessageIdRef.current = lastMsg.messageId
        scheduleReadFlush(roomId, lastMsg.messageId)
      }
    } catch {
      setLoading(false)
    }
  }

  // 메시지 전송 (ChatInput에서 호출)
  const handleSendMessage = useCallback((content: string) => {
    sendMessage(roomId, { type: 'TEXT', content })
    setScrollOffset(0)
  }, [roomId, sendMessage])

  // 스크롤 핸들러
  const maxScroll = Math.max(0, messages.length - chatHeight)

  const handleScrollUp = useCallback(() => {
    setScrollOffset(prev => Math.min(prev + 1, maxScroll))
  }, [maxScroll])

  const handleScrollDown = useCallback(() => {
    setScrollOffset(prev => Math.max(prev - 1, 0))
  }, [])

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
        connected={isConnected}
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
        onScrollBottom={handleScrollBottom}
        onBack={onBack}
        canScroll={messages.length > chatHeight}
      />
    </Box>
  )
}
