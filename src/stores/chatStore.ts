import { create } from 'zustand'
import { Client } from '@stomp/stompjs'
import type { StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { getToken, getWsUrl, getUser } from '../config.js'

// ============================================
// Types
// ============================================
export interface ChatMessage {
  messageId: number
  roomId: number
  senderId: number
  senderNickname: string
  type: 'TEXT' | 'IMAGE' | 'FILE' | 'GIF'
  content?: string
  fileUrl?: string
  fileName?: string
  createdAt: string
}

export interface RoomUpdate {
  type: 'ROOM_UPDATE'
  roomId: number
  lastMessage: string
  lastMessageTime: string
  lastMessageSenderId: number
  lastMessageSenderNickname: string
  unreadCount: number
}

export interface ReadStatusUpdate {
  userId: number
  messageId: number
}

export interface SendMessageRequest {
  type: 'TEXT' | 'IMAGE' | 'FILE' | 'GIF'
  content?: string
  fileUrl?: string
  fileName?: string
}

// ============================================
// Store Interface
// ============================================
interface ChatState {
  // WebSocket 상태
  isConnected: boolean
  client: Client | null
  connectedUserId: number | null  // 현재 연결된 userId 추적

  // 채팅방 목록 실시간 데이터
  roomUpdates: Map<number, RoomUpdate>

  // 현재 방 정보
  currentRoomId: number | null
  messages: ChatMessage[]

  // 참여자 읽음 상태 추적
  participants: Map<number, { lastReadMessageId: number }>

  // 구독 관리
  subscriptions: Map<string, StompSubscription>

  // 읽음 처리 쓰로틀
  lastSentReadId: number | null
  pendingReadId: number | null
  readTimer: ReturnType<typeof setTimeout> | null

  // Actions
  connect: (userId: number) => void
  disconnect: () => void
  subscribeToUserRooms: (userId: number) => void
  subscribeToRoom: (roomId: number, onMessage: (message: ChatMessage) => void) => void
  subscribeToReadStatus: (roomId: number) => void
  unsubscribeFromRoom: (roomId: number) => void
  setCurrentRoom: (roomId: number | null) => void
  setMessages: (messages: ChatMessage[]) => void
  addMessage: (message: ChatMessage) => void
  sendMessage: (roomId: number, request: SendMessageRequest) => void
  markAsRead: (roomId: number, messageId: number) => void
  scheduleReadFlush: (roomId: number, messageId: number) => void
  flushRead: (roomId: number) => void
  getRoomUpdate: (roomId: number) => RoomUpdate | undefined
  clearRoomUpdate: (roomId: number) => void
  updateParticipantReadStatus: (userId: number, messageId: number) => void
  getParticipantLastRead: (userId: number) => number | undefined
}

// ============================================
// Store Implementation
// ============================================
export const useChatStore = create<ChatState>((set, get) => ({
  isConnected: false,
  client: null,
  connectedUserId: null,
  roomUpdates: new Map(),
  currentRoomId: null,
  messages: [],
  participants: new Map(),
  subscriptions: new Map(),
  lastSentReadId: null,
  pendingReadId: null,
  readTimer: null,

  connect: (userId: number) => {
    const { client: existingClient, connectedUserId } = get()

    // userId가 다르면 기존 연결 끊고 새로 연결
    if (existingClient?.active && connectedUserId !== userId) {
      get().disconnect()
    }

    // 같은 userId로 이미 연결되어 있으면 무시
    if (existingClient?.active && connectedUserId === userId) {
      return
    }

    const token = getToken()
    const wsUrl = getWsUrl()

    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl) as any,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,

      onConnect: () => {
        set({ isConnected: true, connectedUserId: userId })
        // 유저별 룸 업데이트 토픽 구독
        get().subscribeToUserRooms(userId)
      },

      onDisconnect: () => {
        set({ isConnected: false })
      },

      onStompError: () => {
        // STOMP error - 조용히 처리
      },

      onWebSocketError: () => {
        // WebSocket error - 조용히 처리
      },
    })

    set({ client, connectedUserId: userId })
    client.activate()
  },

  disconnect: () => {
    const { client, subscriptions, readTimer } = get()

    // 타이머 정리
    if (readTimer) {
      clearTimeout(readTimer)
    }

    // 모든 구독 해제
    subscriptions.forEach((sub) => sub.unsubscribe())

    if (client) {
      client.deactivate()
    }

    set({
      client: null,
      isConnected: false,
      connectedUserId: null,
      subscriptions: new Map(),
      roomUpdates: new Map(),
      currentRoomId: null,
      messages: [],
      participants: new Map(),
      lastSentReadId: null,
      pendingReadId: null,
      readTimer: null,
    })
  },

  subscribeToUserRooms: (userId: number) => {
    const { client, subscriptions } = get()
    if (!client?.connected) return

    const topic = `/sub/users/${userId}/rooms`
    if (subscriptions.has(topic)) return

    const subscription = client.subscribe(topic, (message) => {
      try {
        const roomUpdate: RoomUpdate = JSON.parse(message.body)
        set((state) => {
          const newRoomUpdates = new Map(state.roomUpdates)
          newRoomUpdates.set(roomUpdate.roomId, roomUpdate)
          return { roomUpdates: newRoomUpdates }
        })
      } catch {
        // parse error 무시
      }
    })

    set({ subscriptions: new Map(subscriptions).set(topic, subscription) })
  },

  subscribeToRoom: (roomId: number, onMessage: (message: ChatMessage) => void) => {
    const { client, subscriptions } = get()
    if (!client?.connected) return

    const topic = `/sub/chat/rooms/${roomId}`
    if (subscriptions.has(topic)) return

    const subscription = client.subscribe(topic, (message) => {
      try {
        const chatMessage: ChatMessage = JSON.parse(message.body)
        onMessage(chatMessage)
      } catch {
        // parse error 무시
      }
    })

    set({ subscriptions: new Map(subscriptions).set(topic, subscription) })
  },

  subscribeToReadStatus: (roomId: number) => {
    const { client, subscriptions } = get()
    if (!client?.connected) return

    const topic = `/sub/chat/rooms/${roomId}/read`
    if (subscriptions.has(topic)) return

    const subscription = client.subscribe(topic, (message) => {
      try {
        const data: ReadStatusUpdate = JSON.parse(message.body)
        get().updateParticipantReadStatus(data.userId, data.messageId)
      } catch {
        // parse error 무시
      }
    })

    set({ subscriptions: new Map(subscriptions).set(topic, subscription) })
  },

  unsubscribeFromRoom: (roomId: number) => {
    const { subscriptions } = get()
    const newSubscriptions = new Map(subscriptions)

    const messageTopic = `/sub/chat/rooms/${roomId}`
    const readTopic = `/sub/chat/rooms/${roomId}/read`

    if (newSubscriptions.has(messageTopic)) {
      newSubscriptions.get(messageTopic)?.unsubscribe()
      newSubscriptions.delete(messageTopic)
    }

    if (newSubscriptions.has(readTopic)) {
      newSubscriptions.get(readTopic)?.unsubscribe()
      newSubscriptions.delete(readTopic)
    }

    set({ subscriptions: newSubscriptions, participants: new Map() })
  },

  setCurrentRoom: (roomId: number | null) => {
    set({ currentRoomId: roomId, messages: [], participants: new Map() })
  },

  setMessages: (messages: ChatMessage[]) => {
    set({ messages })
  },

  addMessage: (message: ChatMessage) => {
    set((state) => ({
      messages: [...state.messages, message],
    }))
  },

  sendMessage: (roomId: number, request: SendMessageRequest) => {
    const { client } = get()
    if (client?.connected) {
      client.publish({
        destination: `/pub/chat/rooms/${roomId}`,
        body: JSON.stringify(request),
      })
    }
  },

  markAsRead: (roomId: number, messageId: number) => {
    const { client } = get()
    if (client?.connected) {
      client.publish({
        destination: `/pub/chat/rooms/${roomId}/read`,
        body: JSON.stringify({ messageId }),
      })
    }
  },

  scheduleReadFlush: (roomId: number, messageId: number) => {
    const { readTimer } = get()

    set({ pendingReadId: messageId })

    if (readTimer) return // 이미 타이머가 있으면 스킵

    const timer = setTimeout(() => {
      get().flushRead(roomId)
    }, 300)

    set({ readTimer: timer })
  },

  flushRead: (roomId: number) => {
    const { pendingReadId, lastSentReadId, client, readTimer } = get()

    if (readTimer) {
      clearTimeout(readTimer)
    }

    set({ readTimer: null })

    if (pendingReadId === null) return
    if (pendingReadId === lastSentReadId) return
    if (!client?.connected) return

    client.publish({
      destination: `/pub/chat/rooms/${roomId}/read`,
      body: JSON.stringify({ messageId: pendingReadId }),
    })

    set({ lastSentReadId: pendingReadId, pendingReadId: null })
  },

  getRoomUpdate: (roomId: number) => {
    return get().roomUpdates.get(roomId)
  },

  clearRoomUpdate: (roomId: number) => {
    set((state) => {
      const newRoomUpdates = new Map(state.roomUpdates)
      newRoomUpdates.delete(roomId)
      return { roomUpdates: newRoomUpdates }
    })
  },

  updateParticipantReadStatus: (userId: number, messageId: number) => {
    set((state) => {
      const newParticipants = new Map(state.participants)
      newParticipants.set(userId, { lastReadMessageId: messageId })
      return { participants: newParticipants }
    })
  },

  getParticipantLastRead: (userId: number) => {
    return get().participants.get(userId)?.lastReadMessageId
  },
}))

export default useChatStore
