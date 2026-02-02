import React, { useState, useEffect, useRef } from 'react'
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

interface Props {
  roomId: number
  roomName: string
  onBack: () => void
}

export default function ChatScreen({ roomId, roomName, onBack }: Props) {
  const { theme } = useTheme()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const clientRef = useRef<Client | null>(null)
  const { userId } = getUser()

  useEffect(() => {
    loadMessages()
    connectWebSocket()

    return () => {
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
          const msg = JSON.parse(message.body)
          setMessages((prev) => [...prev, msg])
        })
      },
      onDisconnect: () => {
        setConnected(false)
      },
      onStompError: (frame) => {
        console.error('STOMP error:', frame.headers['message'])
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
  }

  useInput((_, key) => {
    if (key.escape) {
      onBack()
    }
  })

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  // 최근 8개 메시지만 표시
  const displayMessages = messages.slice(-8)

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} justifyContent="space-between">
        <Box>
          <Text bold color={theme.primary}>📍 {roomName}</Text>
        </Box>
        <Text color={connected ? theme.success : theme.warning}>
          {connected ? '● 연결됨' : '○ 연결 중...'}
        </Text>
      </Box>

      <Box
        flexDirection="column"
        height={12}
        borderStyle="round"
        borderColor={theme.border}
        paddingX={1}
        paddingY={0}
      >
        {loading ? (
          <Text color={theme.textMuted}>메시지 로딩 중...</Text>
        ) : displayMessages.length === 0 ? (
          <Text color={theme.textMuted}>메시지가 없습니다. 첫 메시지를 보내보세요!</Text>
        ) : (
          displayMessages.map((msg) => {
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

      <Box marginTop={1}>
        <Text color={theme.success}>❯ </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={sendMessage}
          focus={true}
          placeholder="메시지를 입력하세요..."
        />
      </Box>

      <Box marginTop={1}>
        <Text color={theme.textMuted}>Enter: 전송 | ESC: 뒤로가기</Text>
      </Box>
    </Box>
  )
}
