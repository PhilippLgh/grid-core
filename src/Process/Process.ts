import BufferedPty from './BufferedPty'
import { uuid } from '../util'
import * as pty from 'node-pty'

interface ProcessStartOptions {
  shell?: boolean | string
}

export class Process {
  private _pid: string
  private _id: string
  constructor(
    private readonly _binaryPath: string, 
    private readonly _jobId?: string // if the process is associated to a job this has to be set
  ) {
    this._pid = '-1'
    this._id = `process:${uuid()}`
  }
  public _process?: BufferedPty
  /*
  isPty: true,
  */
  get id() {
    return this._id
  }
  get pid() {
    return this._pid
  }
  get jobId() {
    return this._jobId
  }
  get state() {
    return ''
  }
  async start(flags: Array<string> = [], {
    shell = false
  } : ProcessStartOptions = {}) {
    if (shell === true) {
      shell = process.platform === 'win32' ? process.env.ComSpec || '' : process.platform === 'darwin' ? '/bin/zsh' : '/bin/sh'
    }
    // var ptyProcess = pty.spawn(shell, ['-c', `"${this._binaryPath}"`], {
    var ptyProcess = pty.spawn(this._binaryPath, flags, {
      name: 'xterm-color',
      cols: 180,
      rows: 30,
      cwd: process.cwd(),
      // @ts-ignore
      env: {
        ...process.env,
      }
    })
    this._pid = `${ptyProcess.pid}`
    this._process = new BufferedPty(ptyProcess)
  }
  async stop() {
    if (!this._process) { return }
    return this._process.stop()
  }
}