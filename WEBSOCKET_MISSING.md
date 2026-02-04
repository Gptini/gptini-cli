# CLI WebSocket 기능 구현 현황

Frontend와 비교했을 때 CLI의 WebSocket 기능 구현 상태입니다.

---

## 구현 완료

| 기능 | Topic | 상태 |
|------|-------|------|
| 메시지 수신 | `/sub/chat/rooms/{roomId}` | ✅ |
| 메시지 전송 | `/pub/chat/rooms/{roomId}` | ✅ |
| 읽음 상태 전송 | `/pub/chat/rooms/{roomId}/read` | ✅ |
| **채팅방 목록 실시간 갱신** | `/sub/users/{userId}/rooms` | ✅ NEW |
| **읽음 상태 구독 (수신)** | `/sub/chat/rooms/{roomId}/read` | ✅ NEW |
| **참여자 읽음 상태 추적** | - | ✅ NEW |
| **전역 WebSocket 연결 관리** | - | ✅ NEW |
| **구독 관리 시스템** | - | ✅ NEW |

---

## 구현 내용 상세

### 1. 전역 WebSocket Store (`stores/chatStore.ts`)
- Zustand 기반 상태 관리
- 전역 WebSocket 연결 유지 (화면 전환 시에도 연결 유지)
- 구독 관리 (subscriptions Map)
- 읽음 처리 쓰로틀링 (300ms)

### 2. 채팅방 목록 실시간 갱신
- `/sub/users/{userId}/rooms` 구독
- RoomUpdate 수신 시 roomUpdates Map에 저장
- RoomsScreen에서 displayRooms로 병합하여 표시
- 최근 업데이트된 방이 위로 정렬

### 3. 읽음 상태 구독
- `/sub/chat/rooms/{roomId}/read` 구독
- ReadStatusUpdate 수신 시 participants Map 업데이트
- 참여자별 lastReadMessageId 추적

### 4. 구독 관리
- 방 입장 시: `subscribeToRoom()`, `subscribeToReadStatus()` 호출
- 방 퇴장 시: `unsubscribeFromRoom()` 호출하여 정리

---

## 미구현 (필요시 추가)

| 기능 | 우선순위 | 비고 |
|------|----------|------|
| 다양한 메시지 타입 (IMAGE, FILE, GIF) | LOW | CLI에서 파일 표시 어려움 |
| REST API 폴백 동기화 | LOW | 안정성 개선 |

---

## 파일 구조

```
cli/src/
├── stores/
│   └── chatStore.ts     # WebSocket 전역 상태 관리 (NEW)
├── screens/
│   ├── RoomsScreen.tsx  # chatStore 연동 (수정)
│   └── ChatScreen.tsx   # chatStore 연동 (수정)
└── ...
```

---

## 타입 정의

```typescript
// stores/chatStore.ts

interface ChatMessage {
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

interface RoomUpdate {
  type: 'ROOM_UPDATE'
  roomId: number
  lastMessage: string
  lastMessageTime: string
  lastMessageSenderId: number
  lastMessageSenderNickname: string
  unreadCount: number
}

interface ReadStatusUpdate {
  userId: number
  messageId: number
}
```
