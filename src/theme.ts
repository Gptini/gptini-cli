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

const lightTheme: Theme = {
  primary: 'blue',
  secondary: 'cyan',
  success: 'green',
  error: 'red',
  warning: 'yellow',
  text: 'black',
  textMuted: 'gray',
  border: 'gray',
  myMessage: 'green',
  otherMessage: 'blue',
  background: 'white'
}

const darkTheme: Theme = {
  primary: 'cyan',
  secondary: 'blue',
  success: 'greenBright',
  error: 'redBright',
  warning: 'yellowBright',
  text: 'white',
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
