# 풀스크린 채팅 화면 구현 계획

## 현재 상태 분석

### 현재 구조
```
┌─────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════╗  │  ← 항상 표시되는 헤더
│  ║         GPTini CLI Chat               ║  │
│  ╚═══════════════════════════════════════╝  │
│                                             │
│  [Login/Rooms/Chat Screen 내용]             │  ← 같은 레이아웃 안에서 전환
│                                             │
│  Ctrl+C: 종료 | t: 테마 변경                │  ← 항상 표시되는 푸터
└─────────────────────────────────────────────┘
```

### 현재 문제점
1. **스크롤 없음**: 최근 8개 메시지만 표시 (`messages.slice(-8)`)
2. **고정 높이**: `height={12}`로 채팅 영역 제한
3. **동일 화면**: 헤더/푸터가 계속 보이며 공간 낭비
4. **화면 전환 없음**: 같은 렌더링 컨텍스트에서 컴포넌트만 교체

---

## 목표 구현

### k9s / Claude Code 스타일 화면 전환
```
[Rooms Screen]                    [Chat Screen - 풀스크린]
┌─────────────────────┐           ┌─────────────────────────────────┐
│  GPTini CLI         │           │ 📍 방이름          ● 연결됨     │
│  ───────────────    │  Enter    │ ─────────────────────────────── │
│  > 방 1             │  ──────►  │ user1: 안녕하세요               │
│    방 2             │           │ user2: 반갑습니다               │
│    방 3             │           │ ...                             │
│                     │           │ (스크롤 가능)                   │
│                     │  ◄──────  │ ─────────────────────────────── │
│  r:새로고침 q:로그아웃│   ESC     │ ❯ 메시지 입력...               │
└─────────────────────┘           │ Enter:전송 ESC:뒤로 ↑↓:스크롤   │
                                  └─────────────────────────────────┘
```

---

## 구현 전략

### 전략 1: Ink Fullscreen 모드 (권장)

Ink v5는 `fullscreen` 옵션을 지원합니다.

```typescript
// index.tsx
import { render } from 'ink'
import App from './App.js'

render(<App />, {
  fullscreen: true  // 터미널 대체 화면 버퍼 사용
})
```

**장점**:
- Ink 내장 기능으로 안정적
- 자동으로 화면 크기 추적
- 종료 시 원래 화면 복원

### 전략 2: 수동 Alternate Screen Buffer

```typescript
// 대체 버퍼로 전환
process.stdout.write('\x1b[?1049h')

// 원래 버퍼로 복원
process.stdout.write('\x1b[?1049l')
```

---

## 상세 구현 계획

### Phase 1: 풀스크린 기본 설정

#### 1.1 index.tsx 수정
```typescript
import { render } from 'ink'
import App from './App.js'

const { waitUntilExit } = render(<App />, {
  fullscreen: true
})

waitUntilExit()
```

#### 1.2 터미널 크기 감지 훅 추가
```typescript
// hooks/useTerminalSize.ts
import { useState, useEffect } from 'react'

export function useTerminalSize() {
  const [size, setSize] = useState({
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24
  })

  useEffect(() => {
    const handleResize = () => {
      setSize({
        columns: process.stdout.columns || 80,
        rows: process.stdout.rows || 24
      })
    }

    process.stdout.on('resize', handleResize)
    return () => {
      process.stdout.off('resize', handleResize)
    }
  }, [])

  return size
}
```

---

### Phase 2: 스크롤 가능한 채팅 영역

#### 2.1 스크롤 상태 관리
```typescript
// ChatScreen.tsx
const [scrollOffset, setScrollOffset] = useState(0)
const { rows } = useTerminalSize()

// 표시할 메시지 계산
const visibleHeight = rows - 6  // 헤더, 입력창, 도움말 제외
const visibleMessages = messages.slice(
  Math.max(0, messages.length - visibleHeight - scrollOffset),
  messages.length - scrollOffset
)
```

#### 2.2 스크롤 키 바인딩
```typescript
useInput((input, key) => {
  if (key.escape) {
    onBack()
  }
  if (key.upArrow || input === 'k') {
    // 위로 스크롤 (이전 메시지)
    setScrollOffset(prev => Math.min(prev + 1, messages.length - visibleHeight))
  }
  if (key.downArrow || input === 'j') {
    // 아래로 스크롤 (최신 메시지)
    setScrollOffset(prev => Math.max(prev - 1, 0))
  }
  if (input === 'g' && key.shift) {
    // 맨 위로
    setScrollOffset(messages.length - visibleHeight)
  }
  if (input === 'G') {
    // 맨 아래로
    setScrollOffset(0)
  }
})
```

#### 2.3 새 메시지 시 자동 스크롤
```typescript
useEffect(() => {
  // 스크롤이 맨 아래에 있을 때만 자동 스크롤
  if (scrollOffset === 0) {
    // 이미 맨 아래이므로 유지
  }
}, [messages.length])
```

---

### Phase 3: App.tsx 화면 전환 리팩토링

#### 3.1 조건부 레이아웃
```typescript
function AppContent() {
  const { rows, columns } = useTerminalSize()

  // 채팅 화면은 완전히 다른 레이아웃
  if (screen === 'chat' && selectedRoomId) {
    return (
      <ChatScreen
        roomId={selectedRoomId}
        roomName={selectedRoomName}
        onBack={handleBackToRooms}
        terminalSize={{ rows, columns }}
      />
    )
  }

  // 나머지 화면은 기존 레이아웃 유지
  return (
    <Box flexDirection="column" padding={1}>
      {/* 헤더 */}
      <Header />

      {screen === 'login' && <LoginScreen onSuccess={handleLoginSuccess} />}
      {screen === 'rooms' && <RoomsScreen onSelectRoom={handleSelectRoom} />}

      {/* 푸터 */}
      <Footer />
    </Box>
  )
}
```

---

### Phase 4: ChatScreen 풀스크린 UI

#### 4.1 새로운 ChatScreen 레이아웃
```typescript
export default function ChatScreen({ roomId, roomName, onBack, terminalSize }: Props) {
  const { rows, columns } = terminalSize
  const { theme } = useTheme()
  const [scrollOffset, setScrollOffset] = useState(0)

  // 레이아웃 계산
  const headerHeight = 2
  const inputHeight = 2
  const helpHeight = 1
  const chatHeight = rows - headerHeight - inputHeight - helpHeight - 2

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      {/* 헤더 */}
      <Box height={headerHeight} justifyContent="space-between" paddingX={1}>
        <Text bold color={theme.primary}>📍 {roomName}</Text>
        <Text color={connected ? theme.success : theme.warning}>
          {connected ? '● 연결됨' : '○ 연결 중...'}
        </Text>
      </Box>

      {/* 구분선 */}
      <Box paddingX={1}>
        <Text color={theme.border}>{'─'.repeat(columns - 2)}</Text>
      </Box>

      {/* 채팅 메시지 영역 - 스크롤 가능 */}
      <Box
        flexDirection="column"
        height={chatHeight}
        paddingX={1}
        overflowY="hidden"
      >
        {visibleMessages.map((msg) => (
          <MessageRow key={msg.messageId} message={msg} isMe={msg.senderId === userId} />
        ))}
      </Box>

      {/* 스크롤 인디케이터 */}
      {scrollOffset > 0 && (
        <Box justifyContent="center">
          <Text color={theme.textMuted}>↓ {scrollOffset}개 더 있음</Text>
        </Box>
      )}

      {/* 구분선 */}
      <Box paddingX={1}>
        <Text color={theme.border}>{'─'.repeat(columns - 2)}</Text>
      </Box>

      {/* 입력창 */}
      <Box height={inputHeight} paddingX={1}>
        <Text color={theme.success}>❯ </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={sendMessage}
          focus={true}
          placeholder="메시지를 입력하세요..."
        />
      </Box>

      {/* 도움말 */}
      <Box height={helpHeight} paddingX={1}>
        <Text color={theme.textMuted}>
          Enter:전송 | ESC:뒤로 | ↑/k:위로 | ↓/j:아래로 | G:최신
        </Text>
      </Box>
    </Box>
  )
}
```

---

## 파일 변경 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/index.tsx` | fullscreen: true 옵션 추가 |
| `src/hooks/useTerminalSize.ts` | 새 파일 - 터미널 크기 감지 훅 |
| `src/App.tsx` | 채팅 화면일 때 다른 레이아웃 사용 |
| `src/screens/ChatScreen.tsx` | 풀스크린 UI + 스크롤 구현 |

---

## 키 바인딩 정리

### 채팅 화면 (풀스크린)
| 키 | 동작 |
|----|------|
| `Enter` | 메시지 전송 |
| `ESC` | 방 목록으로 돌아가기 |
| `↑` / `k` | 위로 스크롤 (이전 메시지) |
| `↓` / `j` | 아래로 스크롤 (최신 메시지) |
| `g` | 맨 위로 (가장 오래된 메시지) |
| `G` | 맨 아래로 (가장 최신 메시지) |
| `Ctrl+C` | 앱 종료 |

---

## 추가 고려사항

### 1. 입력 모드 전환
스크롤 키(j/k)와 입력이 충돌할 수 있음. 해결 방법:
- 입력창이 비어있을 때만 j/k 스크롤 활성화
- 또는 `Ctrl+↑/↓`로 스크롤

### 2. 메시지 래핑
긴 메시지의 경우 자동 줄바꿈 필요:
```typescript
import wrapAnsi from 'wrap-ansi'

const wrappedContent = wrapAnsi(msg.content, columns - 20, { hard: true })
```

### 3. 유니코드 폭 계산
한글 등 동아시아 문자는 폭이 2임:
```typescript
import stringWidth from 'string-width'

const actualWidth = stringWidth(text)
```

---

## 예상 결과

```
┌───────────────────────────────────────────────────────────────────┐
│ 📍 개발자 채팅방                                        ● 연결됨 │
│ ───────────────────────────────────────────────────────────────── │
│                                                                   │
│ Alice: 안녕하세요!                                     10:30     │
│ Bob: 반갑습니다                                        10:31     │
│ Alice: 오늘 배포 일정 어떻게 되나요?                   10:32     │
│ Charlie: 오후 3시에 진행 예정입니다                    10:33     │
│ Bob: 알겠습니다. 테스트 완료했어요                     10:34     │
│                                                         ◀ 네, 확인했습니다  10:35 │
│                                                                   │
│ ───────────────────────────────────────────────────────────────── │
│ ❯ _                                                               │
│ Enter:전송 | ESC:뒤로 | ↑/k:위로 | ↓/j:아래로 | G:최신           │
└───────────────────────────────────────────────────────────────────┘
```

---

## 구현 순서

1. **Step 1**: `useTerminalSize` 훅 생성
2. **Step 2**: `index.tsx`에 fullscreen 옵션 추가
3. **Step 3**: `App.tsx` 조건부 레이아웃 적용
4. **Step 4**: `ChatScreen.tsx` 풀스크린 UI 구현
5. **Step 5**: 스크롤 기능 구현
6. **Step 6**: 테스트 및 미세 조정
