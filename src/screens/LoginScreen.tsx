import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { login, getMe } from '../api.js'
import { setTokens, setUser } from '../config.js'
import { useTheme } from '../context/ThemeContext.js'
import type { ThemeMode } from '../theme.js'

interface Props {
  onSuccess: () => void
}

type Field = 'theme' | 'email' | 'password'

export default function LoginScreen({ onSuccess }: Props) {
  const { theme, themeMode, toggleTheme } = useTheme()
  const [field, setField] = useState<Field>('theme')
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>(themeMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (field === 'theme') {
      // 테마가 변경되었으면 적용
      if (selectedTheme !== themeMode) {
        toggleTheme()
      }
      setField('email')
      return
    }

    if (field === 'email') {
      if (!email.includes('@')) {
        setError('올바른 이메일을 입력하세요')
        return
      }
      setError('')
      setField('password')
      return
    }

    if (field === 'password') {
      if (!password) {
        setError('비밀번호를 입력하세요')
        return
      }

      setLoading(true)
      setError('')

      try {
        const { accessToken, refreshToken } = await login(email, password)
        setTokens(accessToken, refreshToken)

        const user = await getMe()
        setUser(user.id, user.nickname)

        onSuccess()
      } catch (err) {
        setError('로그인 실패: 이메일 또는 비밀번호를 확인하세요')
        setLoading(false)
      }
    }
  }

  useInput((input, key) => {
    if (field === 'theme') {
      if (key.leftArrow || key.rightArrow || input === 'd' || input === 'l') {
        setSelectedTheme(selectedTheme === 'dark' ? 'light' : 'dark')
      }
      if (key.return) {
        handleSubmit()
      }
    }
    if (key.escape && field === 'password') {
      setField('email')
      setPassword('')
    }
    if (key.escape && field === 'email') {
      setField('theme')
    }
  })

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color={theme.primary}>🔐 로그인</Text>
      </Box>

      {field === 'theme' && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={theme.text}>테마를 선택하세요:</Text>
          <Box marginTop={1}>
            <Text color={selectedTheme === 'dark' ? theme.primary : theme.textMuted}>
              {selectedTheme === 'dark' ? '▶ ' : '  '}
            </Text>
            <Text bold={selectedTheme === 'dark'} color={selectedTheme === 'dark' ? theme.primary : theme.textMuted}>
              🌙 Dark
            </Text>
            <Text>  </Text>
            <Text color={selectedTheme === 'light' ? theme.primary : theme.textMuted}>
              {selectedTheme === 'light' ? '▶ ' : '  '}
            </Text>
            <Text bold={selectedTheme === 'light'} color={selectedTheme === 'light' ? theme.primary : theme.textMuted}>
              ☀️ Light
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color={theme.textMuted}>←→: 선택 | Enter: 확인</Text>
          </Box>
        </Box>
      )}

      {field !== 'theme' && (
        <>
          <Box>
            <Text color={field === 'email' ? theme.success : theme.textMuted}>이메일: </Text>
            {field === 'email' ? (
              <TextInput
                value={email}
                onChange={setEmail}
                onSubmit={handleSubmit}
                focus={field === 'email'}
              />
            ) : (
              <Text color={theme.text}>{email}</Text>
            )}
          </Box>

          <Box>
            <Text color={field === 'password' ? theme.success : theme.textMuted}>비밀번호: </Text>
            {field === 'password' ? (
              <TextInput
                value={password}
                onChange={setPassword}
                mask="*"
                onSubmit={handleSubmit}
                focus={field === 'password'}
              />
            ) : (
              <Text color={theme.textMuted}>{password ? '********' : ''}</Text>
            )}
          </Box>

          {error && (
            <Box marginTop={1}>
              <Text color={theme.error}>⚠ {error}</Text>
            </Box>
          )}

          {loading && (
            <Box marginTop={1}>
              <Text color={theme.warning}>⏳ 로그인 중...</Text>
            </Box>
          )}

          <Box marginTop={1}>
            <Text color={theme.textMuted}>Enter: 다음 | ESC: 이전</Text>
          </Box>
        </>
      )}
    </Box>
  )
}
