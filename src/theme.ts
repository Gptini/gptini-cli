export type ThemeMode = 'light' | 'dark'

export interface Theme {
  primary: string
  secondary: string
  success: string
  error: string
  warning: string
  text: string
  textMuted: string
  border: string
  myMessage: string
  otherMessage: string
  background: string
}

// Light: 흰 배경 터미널용 (어두운 색상 사용)
const lightTheme: Theme = {
  primary: 'blueBright',
  secondary: 'magenta',
  success: 'green',
  error: 'red',
  warning: 'yellow',
  text: 'black',
  textMuted: 'blackBright',
  border: 'blackBright',
  myMessage: 'green',
  otherMessage: 'blue',
  background: 'white'
}

// Dark: 검은 배경 터미널용 (밝은 색상 사용)
const darkTheme: Theme = {
  primary: 'cyanBright',
  secondary: 'magentaBright',
  success: 'greenBright',
  error: 'redBright',
  warning: 'yellowBright',
  text: 'whiteBright',
  textMuted: 'gray',
  border: 'gray',
  myMessage: 'greenBright',
  otherMessage: 'cyanBright',
  background: 'black'
}

export const getTheme = (mode: ThemeMode): Theme => {
  return mode === 'dark' ? darkTheme : lightTheme
}

export const themes = { light: lightTheme, dark: darkTheme }
