import { createCLIPrinter } from '../Bin/cli-utils'
import { ask } from '../Repl'
import Client from '../Clients/Client'
import chalk = require('chalk')
import { getPasswordFromUser } from '../Bin/interactive'

export const print = (str: string) => {
  console.log('PRINT:', str)
}

export interface PrompOptions {
  type?: string
}

export const prompt = async (question: string, {
  type = 'text'
} : PrompOptions = {}) => {
  // TODO based on env different impl
  if (type === 'text') {
    return ask(question)
  } 
  else if (type === 'password') {
    return getPasswordFromUser(question)
  }
}

export const keepAlive = async () => {
  process.stdin.resume()
  return new Promise((resolve, reject) => {
    
  })
}

export const createLogger = (name = '') => {
  // TODO only if CLI env
  const printer = createCLIPrinter()
  return {
    log(message?: any, ...optionalParams: any[]) {
      console.log(chalk.gray(`INFO ${name}:`), message, ...optionalParams)
    },
    logAs(name: string, message?: any, ...optionalParams: any[]){
      console.log(chalk.yellow(`${name}:`), message, ...optionalParams)
    },
    listener: printer.listener
  }
}

interface FlagDescription {
  description: string;
  default: string | boolean | number | undefined
}
type Flags = {[index:string] : FlagDescription}

export const flattenFlags = (flags: any, defaults: Flags = {}) => {
  const flattened : {[index:string] : string} = {}
  flags.forEach((flag: any) => {
    if (flag.flag) {
      flattened[flag.flag] = flag.value
    }
  })
  let _defaults: any = {}
  let keys = Object.keys(defaults)
  for (const key of keys) {
    _defaults[key] = defaults[key].default
  }
  return Object.assign(_defaults, flattened)
}

