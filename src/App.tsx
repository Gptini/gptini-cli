import React, { useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import { isLoggedIn } from './config.js'
import { ThemeProvider, useTheme } from './context/ThemeContext.js'
import LoginScreen from './screens/LoginScreen.js'
import RoomsScreen from './screens/RoomsScreen.js'
import ChatScreen from './screens/ChatScreen.js'

type Screen = 'login' | 'rooms' | 'chat'

function AppContent() {
  const { exit } = useApp()
  const { theme, themeMode, toggleTheme } = useTheme()
  const [screen, setScreen] = useState<Screen>(isLoggedIn() ? 'rooms' : 'login')
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)
  const [selectedRoomName, setSelectedRoomName] = useState<string>('')

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit()
    }
    if (input === 't' && screen !== 'chat') {
      toggleTheme()
    }
  })

  const handleLoginSuccess = () => {
    setScreen('rooms')
  }

  const handleSelectRoom = (roomId: number, roomName: string) => {
    setSelectedRoomId(roomId)
    setSelectedRoomName(roomName)
    setScreen('chat')
  }

  const handleBackToRooms = () => {
    setSelectedRoomId(null)
    setSelectedRoomName('')
    setScreen('rooms')
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.secondary}>
          ╔═══════════════════════════════════════════════╗
        </Text>
      </Box>
      <Box>
        <Text bold color={theme.secondary}>
          ║            🗨️  GPTini CLI Chat                ║
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text bold color={theme.secondary}>
          ╚═══════════════════════════════════════════════╝
        </Text>
      </Box>

      {screen === 'login' && <LoginScreen onSuccess={handleLoginSuccess} />}
      {screen === 'rooms' && <RoomsScreen onSelectRoom={handleSelectRoom} />}
      {screen === 'chat' && selectedRoomId && (
        <ChatScreen
          roomId={selectedRoomId}
          roomName={selectedRoomName}
          onBack={handleBackToRooms}
        />
      )}

      <Box marginTop={1} justifyContent="space-between">
        <Text color={theme.textMuted}>Ctrl+C: 종료 | t: 테마 변경</Text>
        <Text color={theme.textMuted}>[{themeMode === 'dark' ? '🌙 Dark' : '☀️ Light'}]</Text>
      </Box>
    </Box>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}
