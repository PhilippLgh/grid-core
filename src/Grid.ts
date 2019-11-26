import path from 'path'
import { EventEmitter } from 'events'
import PluginManager from './PluginSystem/PluginManager'
import { StateListener, ClientManager, CLIENT_FETCH_STATES } from './Clients/ClientManager'
import { start } from './ApiServer'

const PLUGIN_DIR = path.join(process.cwd(), 'Plugins')

export { CLIENT_FETCH_STATES }

export default class Grid extends EventEmitter {
  pluginManager: PluginManager;
  clientManagers: Array<ClientManager>;
  isReady: boolean;
  constructor(){
    super()
    this.pluginManager = new PluginManager()
    this.clientManagers = []
    this.isReady = false
    this.init()
  }
  // should only be called one -> private
  private async init() {
    await this.pluginManager.scan(PLUGIN_DIR)
    const plugins = await this.pluginManager.getAllPlugins()
    // initialize client managers
    this.clientManagers = plugins.map(plugin => {
      const { pluginExports: config } = plugin
      return new ClientManager(config)
    })
    this.isReady = true
    this.emit('ready')
  }
  whenReady(timeout?: number) {
    if (this.isReady) return Promise.resolve()
    return new Promise((resolve, reject) => {
      this.once('ready', resolve)
    })
  }
  /**
   * returns the list of all evaluated plugin exports
   * i.e. the configuration they produce when run on this machine
   */
  async getAllPlugins() {
    return this.pluginManager.getAllPlugins()
  }
  /**
   * return the list of client managers i.e.
   * wrapped plugins that specify how to fetch and configure eth binaries
   */
  async getAllClientManagers() {
    return this.clientManagers
  }
  async getClientManager(name : string) {
    return this.clientManagers.find(c => c.name === name)
  }
  /**
   * returns a list of **all** clients independent of client managers
   * clients refer to binary+config and a state [running, connected] 
   */
  async getAllClients() {
    const clientManagers = await this.getAllClientManagers()
    const clients = []
    for (const clientManager of clientManagers) {
      const _clients = await clientManager.getAllClients()
      clients.push(..._clients)
    }
    return clients
  }
  async getClient(clientName: string, options : any = {}) {
    options = options
    const spec = options.spec || 'latest'
    const listener = options.listener || undefined
    const clientManager = await this.getClientManager(clientName)
    if (!clientManager) {
      const available = await this.getAllClientManagers()
      throw new Error(`Client "${clientName}" is not supported or found. Try adding a plugin. Available plugins: ${available.map(r => r.name)}`)
    }
    const client = await clientManager.getClient({
      spec,
      listener
    })
    return client
  }
  async startApiServer() {
    const result = await start(this)
    console.log('API ready?', result)
  }
}
