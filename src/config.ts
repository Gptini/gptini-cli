import Conf from 'conf'
import type { ThemeMode } from './theme.js'

interface Config {
  accessToken?: string
  refreshToken?: string
  apiUrl: string
  wsUrl: string
  userId?: number
  nickname?: string
  theme: ThemeMode
}

// GPTINI_PROFILE 환경변수로 다른 프로필 사용 가능
const profile = process.env.GPTINI_PROFILE || 'default'
const projectName = profile === 'default' ? 'gptini-cli' : `gptini-cli-${profile}`

// 환경변수 우선, 없으면 기본값 사용
const defaultApiUrl = process.env.GPTINI_API_URL || 'https://api.gptini.org'
const defaultWsUrl = process.env.GPTINI_WS_URL || 'https://api.gptini.org/ws'

const config = new Conf<Config>({
  projectName,
  defaults: {
    apiUrl: defaultApiUrl,
    wsUrl: defaultWsUrl,
    theme: 'dark'
  }
})

export const getToken = () => config.get('accessToken')
export const setTokens = (accessToken: string, refreshToken: string) => {
  config.set('accessToken', accessToken)
  config.set('refreshToken', refreshToken)
}
export const setUser = (userId: number, nickname: string) => {
  config.set('userId', userId)
  config.set('nickname', nickname)
}
export const getUser = () => ({
  userId: config.get('userId'),
  nickname: config.get('nickname')
})
// 환경변수가 있으면 우선 사용
export const getApiUrl = () => process.env.GPTINI_API_URL || config.get('apiUrl')
export const getWsUrl = () => process.env.GPTINI_WS_URL || config.get('wsUrl')
export const clearAuth = () => {
  config.delete('accessToken')
  config.delete('refreshToken')
  config.delete('userId')
  config.delete('nickname')
}
export const isLoggedIn = () => !!config.get('accessToken')

export const getThemeMode = (): ThemeMode => config.get('theme')
export const setThemeMode = (theme: ThemeMode) => config.set('theme', theme)

export default config
