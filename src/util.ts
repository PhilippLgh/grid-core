import fs from 'fs'

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
        console.log(message, optionalParams)
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


/**
 * RegExps.
 * A URL must match #1 and then at least one of #2/#3.
 * Use two levels of REs to avoid REDOS.
 */

var protocolAndDomainRE = /^(?:\w+:)?\/\/(\S+)$/;

var localhostDomainRE = /^localhost[\:?\d]*(?:[^\:?\d]\S*)?$/
var nonLocalhostDomainRE = /^[^\s\.]+\.\S{2,}$/;

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