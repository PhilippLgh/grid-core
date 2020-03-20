import net from 'net'
import { StringMap } from '../BaseTypes'
import { CLIENT_STATES } from './ClientStates'

export default class IpcRpcApi {

  private state : string = CLIENT_STATES.DISCONNECTED

  private ipc?: net.Socket
  private responsePromises: StringMap = {}
  private partialIpcData?: string

  constructor(private _ipcEndpoint: string) {
  }

  private onIpcData(data: Buffer | string) {
    if(!data) { return }
    if (this.partialIpcData) {
      data = this.partialIpcData.concat(data.toString())
    }

    // try to parse rpc message based on ipc data
    let message
    try {
      message = JSON.parse(data.toString())
      this.partialIpcData = undefined
    } catch (error) {
      this.partialIpcData = data.toString()
      return
    }
    // Return if not a jsonrpc response
    if (!message || !message.jsonrpc) return data

    // check for pending responses and resolve
    const { id, method, result } = message
    const promise = this.responsePromises[id]
    if (promise) {
      // Handle pending promise
      // @ts-ignore
      if (data.type === 'error') {
        promise.reject(message)
      } else if (message.error) {
        promise.reject(message.error)
      } else {
        promise.resolve(result)
      }
      delete this.responsePromises[id]
    }
    // TODO else: handle rpc push
  }

  private writeToIpc(payload: any) {
    if (!this.ipc || this.state !== CLIENT_STATES.CONNECTED) {
      throw Error('IPC Not Connected')
    }
    const ipc = this.ipc
    return new Promise((resolve, reject) => {
      const jsonString = JSON.stringify(payload)
      ipc.write(jsonString)
      // Add response promise
      this.responsePromises[payload.id] = { resolve, reject }
    })
  }

   // tries to establish and IPC connection to the spawned process
   connect(ipcPath: string = this._ipcEndpoint) {
    return new Promise((resolve, reject) => {
      if (this.ipc) {
        return reject(new Error('Close existing IPC before reopen.'))
      }
      this.ipc = net.connect({ path: ipcPath })

      const onIpcConnect = () => {
        this.state = CLIENT_STATES.CONNECTED
        resolve(this.state)
        // this.debug('IPC Connected.')
      }

      const onIpcEnd = () => {
        if (![CLIENT_STATES.STOPPING, CLIENT_STATES.STOPPED].includes(this.state)) {
          this.state = CLIENT_STATES.DISCONNECTED
        }
        this.ipc = undefined
        // this.debug('IPC Connection Ended')
      }

      const onIpcError = (error: Error) => {
        this.state = CLIENT_STATES.ERROR
        this.ipc = undefined
        reject(error)
      }

      const onIpcTimeout = () => {
        this.state = CLIENT_STATES.ERROR
        this.ipc = undefined
        reject(new Error('IPC connection timed out'))
      }

      this.ipc.on('connect', onIpcConnect.bind(this))
      this.ipc.on('end', onIpcEnd.bind(this))
      this.ipc.on('error', onIpcError.bind(this))
      this.ipc.on('timeout', onIpcTimeout.bind(this))
      this.ipc.on('data', this.onIpcData.bind(this))
    })
  }

  async send(method : string, params = [], id = 0, result = undefined) {
    let rpcId = 1
    const payload : {[index: string]: any} = {
      jsonrpc: '2.0',
      id: id || rpcId++,
    }
    if (result) {
      payload.result = result
    } else {
      payload.method = method
      payload.params = params
    }
    return this.writeToIpc(payload)
  }
}