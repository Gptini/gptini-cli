#!/usr/bin/env node
import React from 'react'
import { render } from 'ink'
import App from './App.js'

// 대체 화면 버퍼로 전환 (k9s, vim 스타일)
process.stdout.write('\x1b[?1049h')  // alternate screen 진입
process.stdout.write('\x1b[2J')      // 화면 전체 클리어
process.stdout.write('\x1b[H')       // 커서 홈(0,0)으로
process.stdout.write('\x1b[?25l')    // 커서 숨기기

const { waitUntilExit } = render(<App />)

waitUntilExit().then(() => {
  // 커서 다시 보이기 + 원래 화면 버퍼로 복원
  process.stdout.write('\x1b[?25h')
  process.stdout.write('\x1b[?1049l')
})
