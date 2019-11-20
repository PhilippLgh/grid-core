import path from 'path'
import { EventEmitter } from 'events'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import net from 'net'
import { Writable } from 'stream'

type StringMap = {[index: string] : string}

export const STATES : StringMap = {
  DOWNLOADING: 'DOWNLOADING',
  EXTRACTING: 'EXTRACTING',
  STARTING: 'STARTING',
  STARTED: 'STARTED',
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  STOPPING: 'STOPPING',
  STOPPED: 'STOPPED',
  ERROR: 'ERROR',
}

type IpcPath = string
type IpcResolver = (log : string) => IpcPath | undefined

class ControlledProcess extends EventEmitter {

  // FIXME type <any> members
  binaryPath: string
  ipc: any
  logs: any[]
  debug: Function
  _state: string
  process?: ChildProcessWithoutNullStreams
  responsePromises: any
  partialData: any
  stdin?: Writable
  resolveIpc: Function
  ipcPath?: IpcPath

  constructor(binaryPath: string, resolveIpc: IpcResolver ) {
    super()
    this.binaryPath = binaryPath
    this.resolveIpc = resolveIpc
    // this.handleData = handleData
    this.debug = console.log // debug(name)
    this.ipc = undefined
    this.stdin = undefined
    this.logs = []
    this._state = STATES.STOPPED
    this.responsePromises = []
  }
  get state() {
    return this._state
  }
  set state(newState : string) {
    this._state = newState
    this.emit('newState', this._state)
  }
  get isRunning() {
    return [STATES.STARTING, STATES.STARTED, STATES.CONNECTED].includes(
      this.state
    )
  }
  emitPluginError(error: string | Error) {
    this.debug('Error:', error)
    this.emit('pluginError', {
      message: error.toString(),
      key: new Date().getTime() + Math.random()
    })
  }

  start(flags: Array<string> = []) {
    return new Promise((resolve, reject) => {
      this.state = STATES.STARTING
      this.debug('Start: ', this.binaryPath)
      this.debug('Flags: ', flags)
      let hasFiredOnStart = false

      flags = flags || []

      // Add start cmd to logs
      const cmd = `${this.binaryPath} ${flags.join(' ')}`
      this.logs.push(cmd)

      // Spawn process
      const proc = spawn(this.binaryPath, flags)
      const { stdout, stderr, stdin } = proc
      this.process = proc
      this.stdin = stdin

      const onProcError = (error : Error) => {
        this.state = STATES.ERROR
        this.emitPluginError(error)
        reject(error)
      }

      const onProcClose = (code: number) => {
        if (this.state !== STATES.STOPPED) {
          this.state = STATES.STOPPED
        }

        if (code && code !== 0) {
          // Closing with any code other than 0 means there was an error
          const errorMessage = `${this.binaryPath} child process exited with code: ${code}`
          this.emitPluginError(errorMessage)
          this.debug('DEBUG Last 10 log lines: ', this.logs.slice(-10))
          reject(errorMessage)
        }
      }

      const onStart = () => {
        if (hasFiredOnStart) {
          return
        }
        hasFiredOnStart = true
        this.state = STATES.STARTED
        // Check for and connect IPC in 1s
        setTimeout(async () => {
          try {
            if (this.resolveIpc) {
              /* FIXME
              // Recheck in 3s
              setTimeout(() => {
                debug('IPC endpoint not found, rechecking in 3s...')
                this.connectIpc(onConnect)
              }, 3000)
              */
              this.ipcPath = this.resolveIpc(this.logs)
            }
            if (this.ipcPath) {
              console.log('Connecting to IPC at', this.ipcPath)
              const state = await this.connectIPC(this.ipcPath)
              if (state === STATES.CONNECTED) {
                resolve(this)
              }
            } else {
              // throw new Error('Could not resolve IPC path.')
              // FIXED: ipfs app won't start if ipfs is started as daemon which will work even without ipc
              this.debug(
                `Failed to establish ipc connection: 'Could not resolve IPC path.'`
              )
              resolve(this)
            }
          } catch (error) {
            this.debug(`Failed to establish ipc connection: ${error.message}`)
          }
        }, 3000) // FIXME require long timeouts in tests - better solution?
      }

      const onData = (data: any) => {
        const log = data.toString()
        if (log) {
          let parts = log.split(/\r|\n/)
          parts = parts.filter((p : string) => !['', '> '].includes(p))
          this.logs.push(...parts)
          parts.map((logPart : string) => {
            this.emit('log', logPart)
            /* FIXME remove comment
            if (this.handleData) {
              this.handleData(logPart, this.emit.bind(this), Notification)
            }
            */
            if (/^error\W/.test(logPart.toLowerCase())) {
              this.emitPluginError(logPart)
            }
          })
        }
      }

      proc.on('error', onProcError.bind(this))
      proc.on('close', onProcClose.bind(this))
      stdout.once('data', onStart.bind(this))
      stderr.once('data', onStart.bind(this))
      stdout.on('data', onData.bind(this))
      stderr.on('data', onData.bind(this))
    })
  }
  stop() {
    return new Promise((resolve, reject) => {
      // FIXME kill IPC ? or is it indirectly closed: onIpcEnd
      if (!this.process || !this.isRunning) {
        return resolve(this)
      }
      if (this.state !== STATES.STOPPED) {
        this.state = STATES.STOPPING
      }
      const onProcExit = () => {
        if (this.state !== STATES.STOPPED) {
          this.state = STATES.STOPPED
        }
        resolve(this)
      }
      const onProcError = (error : Error) => {
        this.state = STATES.ERROR
        this.emitPluginError(error)
        reject(new Error('Error Stopping: ' + (error ? error.toString() : '')))
      }
      this.process.on('exit', onProcExit.bind(this))
      this.process.on('error', onProcError.bind(this))
      this.process.kill('SIGINT')
      // this.ipcPath = null
    })
  }
  // tries to establish and IPC connection to the spawned process
  connectIPC(ipcPath: string) {
    return new Promise((resolve, reject) => {
      if (this.ipc) {
        return reject(new Error('Close existing IPC before reopen.'))
      }
      this.ipc = net.connect({ path: ipcPath })

      const onIpcConnect = () => {
        this.state = STATES.CONNECTED
        resolve(this.state)
        this.debug('IPC Connected.')
      }

      const onIpcEnd = () => {
        if (![STATES.STOPPING, STATES.STOPPED].includes(this.state)) {
          this.state = STATES.DISCONNECTED
        }
        this.ipc = null
        this.debug('IPC Connection Ended')
      }

      const onIpcError = (error: Error) => {
        this.state = STATES.ERROR
        this.ipc = null
        this.emitPluginError('IPC Connection Error: ' + (error ? error.message : ''))
      }

      const onIpcTimeout = () => {
        this.state = STATES.ERROR
        this.ipc = null
        this.emitPluginError('IPC Connection Timeout')
        reject(new Error('IPC connection timed out'))
      }

      this.ipc.on('connect', onIpcConnect.bind(this))
      this.ipc.on('end', onIpcEnd.bind(this))
      this.ipc.on('error', onIpcError.bind(this))
      this.ipc.on('timeout', onIpcTimeout.bind(this))
      this.ipc.on('data', this.onIpcData.bind(this))
    })
  }
  onIpcData(data: any) {
    if (!data) return
    if (this.partialData) {
      data = this.partialData.concat(data.toString())
    }

    let message
    try {
      message = JSON.parse(data.toString())
      if (this.partialData) {
        this.partialData = null
      }
    } catch (error) {
      // this.debug('Error parsing JSON: ', error)
      // TODO: handle multiple clients
      this.partialData = data.toString()
      return
    }

    // TODO loglevel=verbose
    // this.debug('IPC data: ', data.toString())

    // Return if not a jsonrpc response
    if (!message || !message.jsonrpc) return

    const { id, method, result } = message

    if (typeof id !== 'undefined') {
      const promise = this.responsePromises[id]
      if (promise) {
        // Handle pending promise
        if (data.type === 'error') {
          promise.reject(message)
        } else if (message.error) {
          promise.reject(message.error)
        } else {
          promise.resolve(result)
        }
        delete this.responsePromises[id]
      }
    } else {
      // All other messages grouped into 'notification' category
      // It is the responsibility of the UI to filter for ID
      const { params } = message
      this.emit('notification', params)
    }
  }
  // WARNING: dangerous api
  write(payload: string) {
    if (!this.process) {
      return
    }
    const { stdin } = this.process
    stdin.write(payload + '\n')
    this.debug('Wrote to stdin: ', payload)
  }
  // private low level ipc
  send(payload: any) {
    if (this.state !== STATES.CONNECTED) {
      throw Error('IPC Not Connected')
    }
    return new Promise((resolve, reject) => {
      const jsonString = JSON.stringify(payload)
      this.ipc.write(jsonString)
      // Add response promise
      this.responsePromises[payload.id] = { resolve, reject }
    })
  }
  getLogs() {
    return this.logs
  }
  appendLogs(lines : Array<string>) {
    this.logs = this.logs.concat(lines)
  }
  async restart() {
    await this.stop()
    return this.start()
  }
}

export default ControlledProcess
