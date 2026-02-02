#!/usr/bin/env node
import React from 'react'
import { render } from 'ink'
import App from './App.js'

// 대체 화면 버퍼로 전환 (k9s, vim 스타일)
process.stdout.write('\x1b[?1049h')
process.stdout.write('\x1b[H')

const { waitUntilExit } = render(<App />)

waitUntilExit().then(() => {
  // 원래 화면 버퍼로 복원
  process.stdout.write('\x1b[?1049l')
})
