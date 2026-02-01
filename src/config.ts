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

const config = new Conf<Config>({
  projectName,
  defaults: {
    apiUrl: 'https://api.gptini.org',
    wsUrl: 'https://api.gptini.org/ws',
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
export const getApiUrl = () => config.get('apiUrl')
export const getWsUrl = () => config.get('wsUrl')
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
