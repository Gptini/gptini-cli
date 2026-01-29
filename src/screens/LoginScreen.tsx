import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { login, getMe } from '../api.js'
import { setTokens, setUser } from '../config.js'
import { useTheme } from '../context/ThemeContext.js'

interface Props {
  onSuccess: () => void
}

type Field = 'email' | 'password'

export default function LoginScreen({ onSuccess }: Props) {
  const { theme } = useTheme()
  const [field, setField] = useState<Field>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
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

  useInput((_, key) => {
    if (key.escape && field === 'password') {
      setField('email')
      setPassword('')
    }
  })

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color={theme.primary}>🔐 로그인</Text>
      </Box>

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
    </Box>
  )
}
