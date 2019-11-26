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
                                                
`
console.log(LOGO)

// The second parameter is the path to folder that contains command modules.
let cli = new CLI(``, path.join(__dirname, 'commands'))

// Clime in its core provides an object-based command-line infrastructure.
// To have it work as a common CLI, a shim needs to be applied:
let shim = new Shim(cli)
shim.execute(process.argv)
