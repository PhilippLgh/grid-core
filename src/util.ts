import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'

export const LOGLEVEL = {
  WARN: -1,
  NORMAL: 0,
  VERBOSE: 2
}

class Logger {
  loglevel: number
  constructor(loglevel: number){
    this.loglevel = loglevel
  }
  _log(loglevel = LOGLEVEL.NORMAL, message: string, ...optionalParams: any[]) {
    if (this.loglevel >= loglevel) {
      if (loglevel === LOGLEVEL.WARN) {
        console.log(`WARNING: ${message} ${optionalParams}`)
      } else {
        // console.log(message, ...optionalParams)
      }
    }
  }
  log(message: string, ...optionalParams: any[]) {
    this._log(LOGLEVEL.NORMAL, message, optionalParams)
  }
  print(message: string, ...optionalParams: any[]) {
    this._log(LOGLEVEL.VERBOSE, message, optionalParams)
  }
  warn(message: string, ...optionalParams: any[]) {
    this._log(LOGLEVEL.WARN, message, optionalParams)
  }
}

export const createLogger = (_loglevel: number) => {
  return new Logger(_loglevel)
}

export const isFile = async (filePath: string) : Promise<boolean> => {
  try {
    return fs.statSync(filePath).isFile()
  } catch (error) { 
    return false
  }
}

export const isDir = async (filePath: string) : Promise<boolean> => {
  try {
    return fs.statSync(filePath).isDirectory()
  } catch (error) { 
    return false
  }
}

export const isDirSync = (filePath : string | undefined) => {
  if (filePath === undefined) {
    return false
  }
  try {
    const fileStats = fs.lstatSync(filePath);
    return fileStats.isDirectory()
  } catch (error) {
    return false
  }
}

export const is = {
  windows: process.platform === 'win32',
  mac: process.platform === 'darwin',
  linux: (process.platform !== 'darwin') && (process.platform !== 'win32')
}

export const appDataPath = async (...subPath : Array<string>) => {
  subPath = subPath || []
  const HOME = os.homedir()
  let appdata
  if (is.windows) {
    appdata = process.env.appdata || path.join(HOME, 'AppData', 'Roaming')
  } 
  else if (is.mac) {
    appdata = path.join(HOME, 'Library', 'Application Support')
  } 
  else {
    appdata = process.env.XDG_CONFIG_HOME || path.join(HOME, '.config')
  }
  process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share")
  appdata = path.join(appdata, 'Grid', ...subPath)
  if(!fs.existsSync(appdata)) {
    fs.mkdirSync(appdata, {
      recursive: true
    })
  }
  return appdata
}

export const getDataDir = appDataPath

/**
 * RegExps.
 * A URL must match #1 and then at least one of #2/#3.
 * Use two levels of REs to avoid REDOS.
 */

var protocolAndDomainRE = /^(?:\w+:)?\/\/(\S+)$/;

var localhostDomainRE = /^localhost[\:?\d]*(?:[^\:?\d]\S*)?$/
var nonLocalhostDomainRE = /^[^\s\.]+\.\S{2,}$/;

export const isDirPath = (str: string) => !path.extname(str)

/**
 * Loosely validate a URL `string`.
 * https://github.com/segmentio/is-url/blob/master/index.js
 *
 * @param {String} str
 * @return {Boolean}
 */
export const isUrl = async (str: string) => {
  if (typeof str !== 'string') {
    return false;
  }
  var match = str.match(protocolAndDomainRE);
  if (!match) {
    return false;
  }
  var everythingAfterProtocol = match[1];
  if (!everythingAfterProtocol) {
    return false;
  }
  if (localhostDomainRE.test(everythingAfterProtocol) ||
      nonLocalhostDomainRE.test(everythingAfterProtocol)) {
    return true;
  }
  return false;
}

export const uuid = () => {
  return crypto.randomBytes(3*4).toString('base64')
}

export const resolveRuntimeDependency = (runtimeDependency : any = {}) => {
  const { name, version, type } = runtimeDependency
  if (name === 'Java') {
    if ('JAVA_HOME' in process.env) {
      const JAVA_HOME = process.env['JAVA_HOME']
      if (!JAVA_HOME) {
        return undefined
      }
      const JAVA_BIN = path.join(
        JAVA_HOME,
        'bin',
        process.platform === 'win32' ? 'java.exe' : 'java'
      )
      return fs.existsSync(JAVA_BIN) ? JAVA_BIN : undefined
    } else {
      // MAC:
      if (process.platform === 'darwin') {
        if (fs.existsSync('/Library/Java/JavaVirtualMachines/')) {
          const vms = fs.readdirSync('/Library/Java/JavaVirtualMachines/')
          // /Contents/Home/bin/java
          // console.log('found vms', vms)
        }
        // alternative tests
        // /usr/bin/java
        // /usr/libexec/java_home -V
        // execute 'which java'
        const javaPath = '/usr/bin/java'
        return fs.existsSync(javaPath) ? javaPath : undefined
      }
      // console.log(process.env.PATH.includes('java'))
    }
    return undefined
  }
  return undefined
}