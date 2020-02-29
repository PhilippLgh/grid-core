#!/usr/bin/env node --no-warnings

import * as path from 'path'
import {CLI, Shim} from 'clime'

const LOGO = ` 
  _____      _     _         _____ _      _____ 
 / ____|    (_)   | |       / ____| |    |_   _|
| |  __ _ __ _  __| |______| |    | |      | |  
| | |_ | '__| |/ _' |______| |    | |      | |  
| |__| | |  | | (_| |      | |____| |____ _| |_ 
 \\_____|_|  |_|\\__,_|       \\_____|______|_____|
                                                
Grid Version ${require('./../../package.json').version}
`
console.log(LOGO)

class MyCLI extends CLI {
  async execute(argv: string[],
    contextExtension: object | string | undefined,
    cwd?: string | undefined,) {
    let _argv = [...argv] // create copy
    let idx = _argv.findIndex(el => el === '--flags')
    if (idx > 0) {
      // take everything behind --flags
      idx = idx+1
      let flags = _argv.slice(idx)
      // and transform into csv list to avoid clime parser problems
      let flagsProcessed = flags.map(f => f.replace('--', '')).join(',')
      argv = argv.slice(0, idx)
      // replace everything behind --flags with one string
      argv = [...argv, flagsProcessed]
    }
    // @ts-ignore
    return super.execute(argv, contextExtension, cwd)
  }
}

// The second parameter is the path to folder that contains command modules.
let cli = new MyCLI(``, path.join(__dirname, 'commands'))

// Clime in its core provides an object-based command-line infrastructure.
// To have it work as a common CLI, a shim needs to be applied:
let shim = new Shim(cli)
shim.execute(process.argv)
