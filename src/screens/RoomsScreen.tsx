import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { getChatRooms } from '../api.js'
import { getUser, clearAuth } from '../config.js'
import { useTheme } from '../context/ThemeContext.js'

interface Room {
  id: number
  name: string
  lastMessage: string | null
  unreadCount: number
}

interface Props {
  onSelectRoom: (roomId: number, roomName: string) => void
}

export default function RoomsScreen({ onSelectRoom }: Props) {
  const { theme } = useTheme()
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { nickname } = getUser()

  useEffect(() => {
    loadRooms()
  }, [])

  const loadRooms = async () => {
    try {
      const data = await getChatRooms()
      setRooms(data)
      setLoading(false)
    } catch (err) {
      setError('채팅방 목록을 불러오지 못했습니다')
      setLoading(false)
    }
  }

  useInput((input, key) => {
    if (loading) return

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1))
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(rooms.length - 1, prev + 1))
    }
    if (key.return && rooms.length > 0) {
      const room = rooms[selectedIndex]
      onSelectRoom(room.id, room.name)
    }
    if (input === 'r') {
      setLoading(true)
      loadRooms()
    }
    if (input === 'q') {
      clearAuth()
      process.exit(0)
    }
  })

  if (loading) {
    return (
      <Box>
        <Text color={theme.warning}>⏳ 채팅방 불러오는 중...</Text>
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Text color={theme.error}>⚠ {error}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color={theme.text}>👋 환영합니다, </Text>
        <Text bold color={theme.success}>{nickname}</Text>
        <Text bold color={theme.text}>님!</Text>
      </Box>

      <Box marginBottom={1}>
        <Text bold color={theme.primary}>💬 채팅방 목록</Text>
        <Text color={theme.textMuted}> ({rooms.length}개)</Text>
      </Box>

      {rooms.length === 0 ? (
        <Box>
          <Text color={theme.textMuted}>참여 중인 채팅방이 없습니다</Text>
        </Box>
      ) : (
        <Box flexDirection="column" borderStyle="round" borderColor={theme.border} paddingX={1}>
          {rooms.map((room, index) => (
            <Box key={room.id}>
              <Text color={selectedIndex === index ? theme.primary : theme.text}>
                {selectedIndex === index ? '▶ ' : '  '}
              </Text>
              <Text color={selectedIndex === index ? theme.primary : theme.text} bold={selectedIndex === index}>
                {room.name}
              </Text>
              {room.unreadCount > 0 && (
                <Text color={theme.error}> ({room.unreadCount})</Text>
              )}
              {room.lastMessage && (
                <Text color={theme.textMuted}>
                  {' - '}
                  {room.lastMessage.slice(0, 25)}
                  {room.lastMessage.length > 25 ? '...' : ''}
                </Text>
              )}
            </Box>
          ))}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={theme.textMuted}>↑↓: 선택 | Enter: 입장 | r: 새로고침 | q: 로그아웃</Text>
      </Box>
    </Box>
  )
}
