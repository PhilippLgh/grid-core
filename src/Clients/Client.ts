import fs from 'fs'
import path from 'path'
import { EventEmitter } from 'events'
import ControlledProcess, { STATES } from '../ControlledProcess'

export { STATES }

export default class Client {

  binaryPath: any;
  process?: ControlledProcess;
  config: any;

  constructor(binaryPath: any, config: any) {
    this.binaryPath = binaryPath
    this.config = config
  }
  get name() {
    return this.config.name
  }
  get displayName() {
    return this.config.displayName
  }
  // we should assume that multiple 
  // instances of one client can be executed at the same time
  get instanceId() {
    return ''
  }
  get version() {
    return ''
  }
  get resolveIpc() {
    return this.config.resolveIpc
  }
  async init() {
    return true
  }
  async start(flags = []) : Promise<ControlledProcess> {
    console.log('start binary', this.binaryPath)
    try {
      this.process = new ControlledProcess(
        this.binaryPath,
        this.resolveIpc,
        // this.handleData
      )
      // this.registerEventListeners(this.process, this)
      await this.process.start(flags)
    } catch (error) {
      console.log(`Plugin Start Error: ${error}`)
      throw new Error(`Plugin Start Error: ${error}`)
    }
    return this.process
  }

  async stop() {

  }

  async execute(command: string) : Promise<Array<string>> {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process')
      let flags : Array<string> = []
      if (typeof command === 'string') {
        flags = command.split(' ')
      }
      let proc = undefined
      try {
        proc = spawn(this.binaryPath, flags)
      } catch (error) {
        // console.log('spawn error', error)
        reject(error)
      }
      const { stdout, stderr, stdin } = proc
      proc.on('error', (error: Error) => {
        console.log('process error', error)
      })
      const procData : Array<string> = []
      const onData = (data: any) => {
        const log = data.toString()
        if (log) {
          let parts = log.split(/\r|\n/)
          parts = parts.filter((p : string) => p !== '')
          //this.logs.push(...parts)
          // parts.map((l: string) => this.emit('log', l))
          procData.push(...parts)
        }
      }
      stdout.on('data', onData)
      stderr.on('data', onData)
      proc.on('close', () => {
        resolve(procData)
      })
    })
  }

  async stateChangedTo(newState : string) {
    if(!this.process) {
      return new Promise((resolve, reject) => {
      
      })
    }
    // TODO does CONNECTED also mean STARTED? -> probably yes
    if (this.process.state === newState) {
      return Promise.resolve(this.process.state)
    } else {
      return new Promise((resolve, reject) => {
        // @ts-ignore
        this.process.once(newState, resolve)
      })
    }
  }

  async rpc(method : string, params = []) {

  }

}
