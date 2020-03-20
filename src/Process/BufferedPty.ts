import { EventEmitter } from 'events'

// https://github.com/microsoft/node-pty/issues/241
export default class BufferedPty extends EventEmitter {
  private _buf : any[] = []
  private MAX_BUF = 1024 * 60
  private isReplaying = false
  constructor(private _pty: any) {
    super()
    this._pty.on('data', (data: any) => {
      if (this._buf.length > this.MAX_BUF) {
        // clear or throw
        throw new Error('Max buffer size exceeded')
      }
      this._buf.push(data)
      if (!this.isReplaying) {
        this.emit('data', data)
      }
    })
  }

  /**
   * Writes data to the socket.
   * @param data The data to write.
   */
  write(data: string): void {
    this._pty.write(data)
  }

  on(event: string | symbol, listener: (...args: any[]) => void): this {
    // "replay" buffer content
    this.isReplaying = true
    super.on(event, listener)
    for (const chunk of this._buf) {
      this.emit('data', chunk)
    }
    this.isReplaying = false
    return this
  }

  stop() {
    this._pty.stop()
  }
}