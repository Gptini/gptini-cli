import notifier from 'node-notifier'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconPath = join(__dirname, '..', 'assets', 'claude-icon.png')

const MESSAGES = [
  '작업이 완료되었습니다. 결과를 확인하세요.',
  '분석이 완료되었습니다. 검토해 주세요.',
  '요청하신 작업을 처리했습니다.',
  '새 결과가 준비되었습니다.',
  '처리가 완료되었습니다. 확인이 필요합니다.',
  '작업 결과를 검토해 주세요.',
  '응답이 준비되었습니다.',
  '검토 요청이 있습니다.',
]

export function notifyNewMessage() {
  const body = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
  notifier.notify({
    title: 'Claude',
    message: body,
    icon: iconPath,
    appID: 'Claude',
  })
}
