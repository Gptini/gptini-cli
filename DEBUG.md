# GPTini CLI 디버그 가이드

## 사용자용: 설치 오류 시 클린 재설치

gptini-cli를 글로벌 설치했는데 오류가 나면:

```bash
# 1. gptini-cli 삭제
npm uninstall -g gptini-cli

# 2. npm 캐시에서 gptini-cli만 삭제
npm cache clean --force gptini-cli

# 3. 다시 설치
npm install -g gptini-cli
```

### 한 줄로 실행

```bash
npm uninstall -g gptini-cli && npm cache clean --force gptini-cli && npm install -g gptini-cli
```

### 설정 파일 초기화 (로그인 정보 삭제)

```bash
# macOS
rm -rf ~/Library/Preferences/gptini-cli-nodejs

# Linux
rm -rf ~/.config/gptini-cli-nodejs
```

---

## 개발자용: 클린 빌드

개발 중 오류 발생 시:

```bash
rm -rf node_modules dist package-lock.json && npm install && npm run build
```

### 설정 파일 초기화 (로그인 정보 삭제)

```bash
# macOS
rm -rf ~/Library/Preferences/gptini-cli-nodejs

# Linux
rm -rf ~/.config/gptini-cli-nodejs
```

---

# 디버그 로깅 가이드

## 로그 파일 위치

```
~/gptini-debug.log
```

## 사용법

### 1. logger 임포트

```typescript
import { log, logError, initLogger, getLogFilePath } from './logger.js'
```

### 2. 앱 시작 시 초기화 (index.tsx)

```typescript
initLogger()
log('INDEX', `App starting. Log file: ${getLogFilePath()}`)
```

### 3. 일반 로그

```typescript
// 기본 로그
log('TAG', '메시지')

// 데이터 포함
log('TAG', '메시지', { key: 'value' })

// 예시
log('CHAT', 'ChatScreen mounted', { roomId, roomName })
log('API', 'Request: GET /api/v1/chat/rooms', { hasToken: !!token })
```

### 4. 에러 로그

```typescript
// 기본 에러
logError('TAG', '에러 메시지')

// Error 객체 포함
logError('TAG', '에러 메시지', error)

// 예시
logError('CHAT', 'loadMessages failed', err)
logError('API', 'Request failed', error.response?.data)
```

## 태그 규칙

| 태그 | 용도 |
|------|------|
| INDEX | 앱 진입점 (index.tsx) |
| APP | App.tsx 관련 |
| CONFIG | 설정 관련 |
| API | API 요청/응답 |
| CHAT | 채팅 화면 |
| ROOMS | 채팅방 목록 화면 |
| LOGIN | 로그인 화면 |

## 실시간 로그 모니터링

```bash
tail -f ~/gptini-debug.log
```

## 로그 파일 초기화

앱 실행 시 `initLogger()`가 호출되면 로그 파일이 초기화됩니다.

## 로그 출력 예시

```
=== GPTini CLI Debug Log ===
Started: 2026-02-04T14:16:26.841Z

[2026-02-04T14:16:26.841Z] [INDEX] App starting. Log file: /Users/user/gptini-debug.log
[2026-02-04T14:16:26.853Z] [ROOMS] RoomsScreen mounted
  Data: {
  "nickname": "test2"
}
[2026-02-04T14:16:26.854Z] [API] Request: GET /api/v1/chat/rooms
  Data: {
  "hasToken": true
}
[2026-02-04T14:16:26.947Z] [API] Response: 200 /api/v1/chat/rooms
```
