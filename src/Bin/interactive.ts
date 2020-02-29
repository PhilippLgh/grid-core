import { prompt as eprompt } from 'enquirer'
import { KeyFileInfo } from 'ethpkg'

export const prompt = async (message: string, defaultVal: any) => {
  const answer: any = await eprompt({
    type: 'input',
    name: 'val',
    message: `${message} (default: ${JSON.stringify(defaultVal)}):`
  })
  return answer['val'] || defaultVal
}

export const getPasswordFromUser = async (message = "Enter password to de/encrypt key", { repeat = false } = {}) => {
  const questionKeyPassword = (message: string) => ({
    type: 'password',
    name: 'password',
    message
  })
  const { password } = await eprompt(questionKeyPassword(message))
  if (!password) {
    throw new Error('Error: no password provided by user')
  }
  if (repeat) {
    const { password: repeated } = await eprompt(questionKeyPassword(`Repeat ${message}`))
    if (password !== repeated) {
      throw new Error('Password input does not match.. typo?')
    }
  }
  return password
}

export const getSelectedKeyFromUser = async (keys: Array<KeyFileInfo>) => {
  const question = [{
    type: 'select',
    name: 'selectedKey',
    message: `Which key do you want to use for signing and publishing?`,
    initial: '',
    choices: keys.map((k: any) => ({ name: k.address, message: `${k.address} ("${k.fileName}")`, keyFile: k.filePath, file: k.fileName })),
    result(value: string): any {
      return keys.find((key) => key.address === value)
    }
  }]
  const { selectedKey } = await eprompt(question)
  return selectedKey
}