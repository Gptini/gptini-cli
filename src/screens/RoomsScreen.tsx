import React, { useState, useEffect, useRef, memo, useMemo } from 'react'
import { Box, Text, useInput } from 'ink'
import { getChatRooms } from '../api.js'
import { getUser, clearAuth } from '../config.js'
import { useTheme } from '../context/ThemeContext.js'
import { useChatStore } from '../stores/chatStore.js'

interface Room {
  id: number
  name: string
  lastMessage: string | null
  unreadCount: number
}

interface Props {
  onSelectRoom: (roomId: number, roomName: string) => void
  onAuthError: () => void
}

// ============================================
// RoomItem - 개별 방 아이템 (memo로 최적화)
// ============================================
interface RoomItemProps {
  room: Room
  isSelected: boolean
}

const RoomItem = memo(function RoomItem({ room, isSelected }: RoomItemProps) {
  const { theme } = useTheme()

  return (
    <Box>
      <Text color={isSelected ? theme.primary : theme.text}>
        {isSelected ? '▶ ' : '  '}
      </Text>
      <Text color={isSelected ? theme.primary : theme.text} bold={isSelected}>
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
  )
})

// ============================================
// RoomList - 방 목록 (memo로 최적화)
// ============================================
interface RoomListProps {
  rooms: Room[]
  selectedIndex: number
}

const RoomList = memo(function RoomList({ rooms, selectedIndex }: RoomListProps) {
  const { theme } = useTheme()

  if (rooms.length === 0) {
    return (
      <Box>
        <Text color={theme.textMuted}>참여 중인 채팅방이 없습니다</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.border} paddingX={1}>
      {rooms.map((room, index) => (
        <RoomItem
          key={room.id}
          room={room}
          isSelected={selectedIndex === index}
        />
      ))}
    </Box>
  )
})

// ============================================
// RoomsHeader - 헤더 (memo로 최적화)
// ============================================
interface RoomsHeaderProps {
  nickname: string | undefined
  roomCount: number
}

const RoomsHeader = memo(function RoomsHeader({ nickname, roomCount }: RoomsHeaderProps) {
  const { theme } = useTheme()

  return (
    <>
      <Box marginBottom={1}>
        <Text bold color={theme.text}>👋 환영합니다, </Text>
        <Text bold color={theme.success}>{nickname}</Text>
        <Text bold color={theme.text}>님!</Text>
      </Box>

      <Box marginBottom={1}>
        <Text bold color={theme.primary}>💬 채팅방 목록</Text>
        <Text color={theme.textMuted}> ({roomCount}개)</Text>
      </Box>
    </>
  )
})

// ============================================
// RoomsFooter - 하단 도움말 (memo로 최적화)
// ============================================
interface RoomsFooterProps {
  themeMode: 'dark' | 'light'
}

const RoomsFooter = memo(function RoomsFooter({ themeMode }: RoomsFooterProps) {
  const { theme } = useTheme()

  return (
    <Box marginTop={1} justifyContent="space-between">
      <Text color={theme.textMuted}>↑↓: 선택 | Enter: 입장 | r: 새로고침 | t: 테마 | q: 종료 | L: 로그아웃</Text>
      <Text color={theme.textMuted}>[{themeMode === 'dark' ? '🌙' : '☀️'}]</Text>
    </Box>
  )
})

// ============================================
// RoomsScreen - 메인 컴포넌트
// ============================================
export default function RoomsScreen({ onSelectRoom, onAuthError }: Props) {
  const { theme, themeMode, toggleTheme } = useTheme()
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // getUser()를 ref로 캐싱
  const userRef = useRef(getUser())
  const { userId, nickname } = userRef.current

  // WebSocket store
  const { connect, disconnect, isConnected, roomUpdates } = useChatStore()

  // WebSocket 연결
  useEffect(() => {
    if (userId && !isConnected) {
      connect(userId)
    }
  }, [userId, isConnected, connect])

  // roomUpdates를 rooms에 병합
  const displayRooms = useMemo(() => {
    if (roomUpdates.size === 0) return rooms

    return rooms.map((room) => {
      const update = roomUpdates.get(room.id)
      if (!update) return room

      return {
        ...room,
        lastMessage: update.lastMessage,
        unreadCount: update.unreadCount,
      }
    }).sort((a, b) => {
      // 최근 업데이트된 방을 위로
      const aUpdate = roomUpdates.get(a.id)
      const bUpdate = roomUpdates.get(b.id)
      if (aUpdate && bUpdate) {
        return new Date(bUpdate.lastMessageTime).getTime() - new Date(aUpdate.lastMessageTime).getTime()
      }
      if (aUpdate) return -1
      if (bUpdate) return 1
      return 0
    })
  }, [rooms, roomUpdates])

  useEffect(() => {
    loadRooms()
  }, [])

  const loadRooms = async () => {
    try {
      const data = await getChatRooms()
      setRooms(data)
      setLoading(false)
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 401 || status === 403) {
        onAuthError()
        return
      }
      const msg = err?.response?.data?.message || err?.message || String(err)
      setError(`채팅방 목록을 불러오지 못했습니다: ${msg}`)
      setLoading(false)
    }
  }

  useInput((input, key) => {
    if (loading) return

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1))
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(displayRooms.length - 1, prev + 1))
    }
    if (key.return && displayRooms.length > 0) {
      const room = displayRooms[selectedIndex]
      onSelectRoom(room.id, room.name)
    }
    if (input === 'r') {
      setLoading(true)
      loadRooms()
    }
    if (input === 'q') {
      process.exit(0)
    }
    if (input === 'L') {
      disconnect()  // WebSocket 연결 끊기
      clearAuth()
      process.exit(0)
    }
    if (input === 't') {
      toggleTheme()
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
      <RoomsHeader nickname={nickname} roomCount={displayRooms.length} />
      <RoomList rooms={displayRooms} selectedIndex={selectedIndex} />
      <RoomsFooter themeMode={themeMode} />
    </Box>
  )
}
