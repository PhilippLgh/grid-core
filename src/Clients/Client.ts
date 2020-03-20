import fs from 'fs'
import path from 'path'
import { StateListener } from '../StateListener'
import { IRelease } from 'ethpkg'
import { PROCESS_EVENTS } from '../ProcessEvents'
import ProcessManager from '../Process/ProcessManager'
import { Process } from '../Process/Process'

import IpcRpcApi from './IpcRpcApi'
import { CLIENT_STATES } from './ClientStates'
import Workflow, { JOB_ID_UNKNOWN } from '../Workflows/Workflow'
export { CLIENT_STATES as STATES }

export interface ClientStartOptions {
  listener?: StateListener;
  entryPoint?: string; // binary path inside container
  service?: boolean; // if the binary is a service (started with container) or execute-once bin
}

export interface ExecuteOptions {
  useBash?: boolean // is the command a bash command
  useEntrypoint?: boolean // is the command input for entrypoint
}

export default class Client {

  binaryPath: any;
  process?: Process;
  config: any;
  packagePath: string | undefined
  metadata: IRelease
  state: string = CLIENT_STATES.STOPPED

  private _processManager: ProcessManager = ProcessManager.getInstance()
  private _rpcApi?: IpcRpcApi

  constructor(
    binaryPath: any,
    config: any,
    metadata: IRelease = { fileName: path.basename(binaryPath) },
    private readonly _jobId = JOB_ID_UNKNOWN
  ) {
    this.binaryPath = binaryPath
    this.config = config
    this.metadata = metadata
    // this.packagePath = packagePath
  }
  get name() {
    return this.config.name
  }
  get displayName() {
    return this.config.displayName
  }
  get version() {
    return this.metadata.version
  }
  private getResolveIpc(): undefined | ((logs: Array<string>) => string) {
    return this.config.resolveIpc || undefined
  }

  /**
   * The promise resolves with a client in *CONNECTED* state and return ipc path if IPC resolver is provided
   * else it will return undefined
   * @param flags 
   */
  async start(flags: Array<string> = [], {
    listener = () => { }
  }: ClientStartOptions = {}): Promise<string | undefined> {
    if (this.state !== CLIENT_STATES.STOPPED) {
      throw new Error('Cannot start client in state: '+this.state)
    }
    listener(PROCESS_EVENTS.CLIENT_START_STARTED, { name: this.name, flags })

    this.process = this._processManager.create(this.binaryPath, this._jobId)
    await this._processManager.start(this.process, flags)

    const ipcResolver = this.getResolveIpc()
    const proc = this.process._process

    if (!proc) {
      throw new Error('Spawned process is undefined')
    }

    if (ipcResolver !== undefined) {
      let attempts = 0
      return new Promise((resolve, reject) => {
        const wrappedIpcResolver = async (data: Buffer) => {
          attempts++
          const ipcPath = ipcResolver(data.toString().split(/\r?\n/) || [])
          // console.log('try resolve ipc', attempts, ipcPath)
          if (ipcPath) {
            proc.removeListener('data', wrappedIpcResolver)
            this._rpcApi = new IpcRpcApi(ipcPath)
            try {
              await this._rpcApi.connect()
            } catch (error) {
              return reject(error)
            }
            listener(PROCESS_EVENTS.CLIENT_START_FINISHED)
            return resolve(ipcPath)
          }
          if (attempts > 50) {
            reject('Could not resolve ipc using the provided output parser: max attempts reached')
          }
        }
        proc.on('data', wrappedIpcResolver)
      })
    }
    
    listener(PROCESS_EVENTS.CLIENT_START_FINISHED)
    return undefined
  }

  async stop() {
    if (!this.process) {
      return
    }
    return this.process.stop()
  }

  async rpc(method: string, params = [], id = 0, result = undefined) {
    if (!this.getResolveIpc()) {
      throw new Error('No IPC RPC API available')
    }
    if (!this.process) {
      throw new Error('RPC API not available - process not running: ' + this.state)
    }
    if (!this._rpcApi) {
      throw new Error('RPC API not initialized')
    }
    return this._rpcApi.send(method, params, id, result)
  }

  async execute(command: string, options?: ExecuteOptions): Promise<Array<string>> {
    throw new Error('not implemented')
    /*
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process')
      let flags: Array<string> = []
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
      const procData: Array<string> = []
      const onData = (data: any) => {
        const log = data.toString()
        if (log) {
          let parts = log.split(/\r|\n/)
          parts = parts.filter((p: string) => p !== '')
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
    */
  }

  async stateChangedTo(newState: string, timeout?: number) {
    throw new Error('not implemented')
  }

}
