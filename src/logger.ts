import fs from 'fs'
import path from 'path'
import os from 'os'

// 로그 파일 경로: ~/gptini-debug.log
const LOG_FILE = path.join(os.homedir(), 'gptini-debug.log')

// 앱 시작 시 로그 파일 초기화
export const initLogger = () => {
  try {
    fs.writeFileSync(LOG_FILE, `=== GPTini CLI Debug Log ===\nStarted: ${new Date().toISOString()}\n\n`)
  } catch (e) {
    // 무시
  }
}

// 로그 작성
export const log = (tag: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString()
  let line = `[${timestamp}] [${tag}] ${message}`

  if (data !== undefined) {
    try {
      const dataStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data)
      line += `\n  Data: ${dataStr}`
    } catch (e) {
      line += `\n  Data: [circular or non-serializable]`
    }
  }

  line += '\n'

  try {
    fs.appendFileSync(LOG_FILE, line)
  } catch (e) {
    // 무시
  }
}

// 에러 로그
export const logError = (tag: string, message: string, error?: any) => {
  const timestamp = new Date().toISOString()
  let line = `[${timestamp}] [${tag}] ERROR: ${message}`

  if (error) {
    if (error instanceof Error) {
      line += `\n  Error: ${error.message}`
      line += `\n  Stack: ${error.stack}`
    } else {
      try {
        line += `\n  Error: ${JSON.stringify(error, null, 2)}`
      } catch (e) {
        line += `\n  Error: ${String(error)}`
      }
    }
  }

  line += '\n'

  try {
    fs.appendFileSync(LOG_FILE, line)
  } catch (e) {
    // 무시
  }
}

export const getLogFilePath = () => LOG_FILE
