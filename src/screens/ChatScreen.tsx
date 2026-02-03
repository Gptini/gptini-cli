import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { getMessages } from '../api.js'
import { getToken, getWsUrl, getUser } from '../config.js'
import { useTheme } from '../context/ThemeContext.js'
import { appendFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const logFile = join(homedir(), 'gptini-debug.log')
const debugLog = (msg: string) => {
  appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`)
}

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

export default function ChatScreen({ roomId, roomName, onBack, terminalSize }: Props) {
  const { theme } = useTheme()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [scrollOffset, setScrollOffset] = useState(0)
  const clientRef = useRef<Client | null>(null)

  // 읽음 처리용 ref
  const lastSentReadIdRef = useRef<number | null>(null)
  const pendingReadIdRef = useRef<number | null>(null)
  const readTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialLoadRef = useRef(true)

  const { userId } = getUser()

  const { rows, columns } = terminalSize

  // 읽음 처리 전송 함수
  const flushRead = useCallback(() => {
    const messageId = pendingReadIdRef.current

    // 타이머 정리 (항상 먼저 실행)
    if (readTimerRef.current) {
      clearTimeout(readTimerRef.current)
      readTimerRef.current = null
    }

    if (messageId === null) {
      debugLog('[READ] messageId is null')
      return
    }
    if (messageId === lastSentReadIdRef.current) {
      debugLog(`[READ] duplicate, skipping: ${messageId}`)
      return // 중복 방지
    }
    if (!clientRef.current?.connected) {
      debugLog('[READ] not connected')
      return
    }

    debugLog(`[READ] sending read: roomId=${roomId}, messageId=${messageId}`)

    // WebSocket으로 읽음 처리 전송
    clientRef.current.publish({
      destination: `/pub/chat/rooms/${roomId}/read`,
      body: JSON.stringify({ messageId })
    })

    lastSentReadIdRef.current = messageId
    pendingReadIdRef.current = null
  }, [roomId])

  // 읽음 처리 스케줄링 (throttle)
  const scheduleReadFlush = useCallback((messageId: number) => {
    // pending 값은 항상 덮어쓰기 (마지막 ID만 유지)
    pendingReadIdRef.current = messageId

    // 이미 타이머가 있으면 스킵 (throttle)
    if (readTimerRef.current) return

    readTimerRef.current = setTimeout(() => {
      flushRead()
    }, 300) // 300ms throttle
  }, [flushRead])

  // 레이아웃 계산
  const headerHeight = 1
  const separatorHeight = 1
  const inputHeight = 1
  const helpHeight = 1
  const paddingHeight = 2
  const chatHeight = Math.max(5, rows - headerHeight - separatorHeight * 2 - inputHeight - helpHeight - paddingHeight)

  useEffect(() => {
    isInitialLoadRef.current = true
    loadMessages()
    connectWebSocket()

    return () => {
      // pending 읽음 처리 즉시 전송
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

  // 새 메시지가 오면 스크롤이 맨 아래일 때만 자동으로 유지
  useEffect(() => {
    if (scrollOffset === 0) {
      // 이미 맨 아래이므로 유지
    }
  }, [messages.length])

  const loadMessages = async () => {
    try {
      const data = await getMessages(roomId)
      setMessages(data)
      setLoading(false)

      // 초기 로드 시 마지막 메시지 읽음 처리
      if (data.length > 0) {
        const lastMsg = data[data.length - 1]
        pendingReadIdRef.current = lastMsg.messageId
        // WebSocket 연결 후 전송되도록 대기
      }
    } catch (err) {
      setLoading(false)
    }
  }

  const connectWebSocket = () => {
    const token = getToken()
    const wsUrl = getWsUrl()

    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl) as any,
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

            // 새 메시지 도착 시 읽음 처리 (throttle)
            scheduleReadFlush(msg.messageId)
          } catch (e) {
            // 에러 발생해도 구독 유지
          }
        })

        // 연결 완료 후 pending 읽음 처리 전송
        if (pendingReadIdRef.current !== null) {
          flushRead()
        }
      },
      onDisconnect: () => {
        setConnected(false)
      },
      onStompError: (frame) => {
        // STOMP error handling
      }
    })

    clientRef.current = client
    client.activate()
  }

  const sendMessage = () => {
    if (!input.trim() || !clientRef.current?.connected) return

    clientRef.current.publish({
      destination: `/pub/chat/rooms/${roomId}`,
      body: JSON.stringify({
        type: 'TEXT',
        content: input.trim()
      })
    })

    setInput('')
    // 메시지 전송 후 맨 아래로
    setScrollOffset(0)
  }

  useInput((inputChar, key) => {
    if (key.escape) {
      onBack()
      return
    }

    // 입력창이 비어있을 때만 스크롤 키 활성화
    if (input === '') {
      const maxScroll = Math.max(0, messages.length - chatHeight)

      if (key.upArrow || inputChar === 'k') {
        setScrollOffset(prev => Math.min(prev + 1, maxScroll))
      }
      if (key.downArrow || inputChar === 'j') {
        setScrollOffset(prev => Math.max(prev - 1, 0))
      }
      if (inputChar === 'g') {
        // 맨 위로 (가장 오래된 메시지)
        setScrollOffset(maxScroll)
      }
      if (inputChar === 'G') {
        // 맨 아래로 (가장 최신 메시지)
        setScrollOffset(0)
      }
    }
  })

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  // 표시할 메시지 계산 (스크롤 적용)
  const startIndex = Math.max(0, messages.length - chatHeight - scrollOffset)
  const endIndex = messages.length - scrollOffset
  const visibleMessages = messages.slice(startIndex, endIndex)

  const maxScroll = Math.max(0, messages.length - chatHeight)
  const hasMoreAbove = scrollOffset < maxScroll
  const hasMoreBelow = scrollOffset > 0

  // 구분선 생성
  const separatorLine = '─'.repeat(Math.max(0, columns - 2))

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      {/* 헤더 */}
      <Box height={headerHeight} justifyContent="space-between" paddingX={1}>
        <Text bold color={theme.primary}>📍 {roomName}</Text>
        <Text color={connected ? theme.success : theme.warning}>
          {connected ? '● 연결됨' : '○ 연결 중...'}
        </Text>
      </Box>

      {/* 상단 구분선 + 스크롤 인디케이터 */}
      <Box height={separatorHeight} paddingX={1} justifyContent="space-between">
        <Text color={theme.border}>{separatorLine}</Text>
      </Box>

      {/* 위로 더 있음 표시 */}
      {hasMoreAbove && (
        <Box justifyContent="center">
          <Text color={theme.textMuted}>↑ {maxScroll - scrollOffset}개 이전 메시지</Text>
        </Box>
      )}

      {/* 채팅 메시지 영역 */}
      <Box
        flexDirection="column"
        flexGrow={1}
        paddingX={1}
      >
        {loading ? (
          <Text color={theme.textMuted}>메시지 로딩 중...</Text>
        ) : visibleMessages.length === 0 && messages.length === 0 ? (
          <Text color={theme.textMuted}>메시지가 없습니다. 첫 메시지를 보내보세요!</Text>
        ) : (
          visibleMessages.map((msg) => {
            const isMe = msg.senderId === userId
            return (
              <Box
                key={msg.messageId}
                justifyContent={isMe ? 'flex-end' : 'flex-start'}
              >
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

      {/* 하단 구분선 */}
      <Box height={separatorHeight} paddingX={1}>
        <Text color={theme.border}>{separatorLine}</Text>
      </Box>

      {/* 입력창 */}
      <Box height={inputHeight} paddingX={1}>
        <Text color={theme.success}>❯ </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={sendMessage}
          focus={true}
          placeholder="메시지를 입력하세요..."
        />
      </Box>

      {/* 도움말 */}
      <Box height={helpHeight} paddingX={1} justifyContent="space-between">
        <Text color={theme.textMuted}>
          Enter:전송 | ESC:뒤로 | ↑k:위로 | ↓j:아래로 | g:맨위 | G:맨아래
        </Text>
        <Text color={theme.textMuted}>
          [{messages.length}개 메시지]
        </Text>
      </Box>
    </Box>
  )
}
