import axios from 'axios'
import { getToken, getApiUrl } from './config.js'

const api = axios.create({
  baseURL: getApiUrl()
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auth
export const login = async (email: string, password: string) => {
  const { data } = await api.post('/api/v1/auth/login', { email, password })
  return data.data
}

export const signUp = async (email: string, password: string, nickname: string) => {
  const { data } = await api.post('/api/v1/auth/signup', { email, password, nickname })
  return data.data
}

export const getMe = async () => {
  const { data } = await api.get('/api/v1/users/me')
  return data.data
}

// Chat Rooms
export const getChatRooms = async () => {
  const { data } = await api.get('/api/v1/chat/rooms')
  return data.data
}

export const getChatRoom = async (roomId: number) => {
  const { data } = await api.get(`/api/v1/chat/rooms/${roomId}`)
  return data.data
}

export const getMessages = async (roomId: number, beforeId?: number) => {
  const params = beforeId ? { beforeId } : {}
  const { data } = await api.get(`/api/v1/chat/rooms/${roomId}/messages`, { params })
  return data.data
}

export default api
