import path from 'path'
import { EventEmitter } from 'events'
import PluginManager from './PluginSystem/PluginManager'
import { StateListener, ClientManager, CLIENT_FETCH_STATES, ClientManagerConfig } from './Clients/ClientManager'
import { start } from './ApiServer'
import ConfigBuilder from './Settings/ConfigBuilder'
import { GLOBAL_SETTINGS } from './Settings/GlobalSettings'
import { WORKFLOW_TAGS, PLUGIN_TYPES } from './constants'
import { createContext } from './PluginContext'
import Workflow from './Workflows/Workflow'
const PLUGIN_DIR = path.join(__dirname, '..', 'Plugins')
const WORKFLOW_DIR = path.join(__dirname, '..', 'Plugins', 'workflows')

export { WORKFLOW_TAGS, PLUGIN_TYPES, GLOBAL_SETTINGS, CLIENT_FETCH_STATES }

export function instanceofClientManagerConfig(object: any): object is ClientManagerConfig {
  return typeof object === 'object' && ('repository' in object)
}

export default class Grid extends EventEmitter {
  pluginManager: PluginManager;
  clientManagers: Array<ClientManager>;
  workflows: Array<Workflow>;
  isReady: boolean;
  constructor(){
    super()
    this.pluginManager = new PluginManager(createContext(this))
    this.clientManagers = []
    this.workflows = []
    this.isReady = false
    this.init()
  }
  // should only be called one -> private
  private async init() {
    await this.pluginManager.scan(PLUGIN_DIR, WORKFLOW_DIR)
    const plugins = await this.pluginManager.getAllPlugins()
    console.log('Initialized', plugins.length, 'plugins:', plugins.map(p => p.name).join(', '))

    // initialize client managers and workflows
    for (const plugin of plugins) {
      const { pluginExports: config } = plugin
      if (config.type === PLUGIN_TYPES.WORKFLOW) {
        this.workflows.push(new Workflow(config))
      }
      else if(config.type === PLUGIN_TYPES.CLIENT){
        this.clientManagers.push(new ClientManager(config))
      }
      else {
        console.log('Invalid plugin found - has not type', config.name)
      }
    }
    console.log('Initialized', this.clientManagers.length, 'ClientManagers')
    console.log('Initialized', this.workflows.length, 'workflows')
    this.isReady = true
    this.emit('ready')
  }
  private whenReady(timeout?: number) {
    if (this.isReady) return Promise.resolve()
    return new Promise((resolve, reject) => {
      this.once('ready', resolve)
    })
  }
  async createSettings(options: any) {
    if (typeof options === 'string') {
      if (options === 'default') {
        return {}
      }
    }
    // FIXME validate options objects here
    return new ConfigBuilder(options)
  }
  /**
   * returns the list of all evaluated plugin exports
   * i.e. the configuration they produce when run on this machine
   */
  async getAllPlugins() {
    await this.whenReady()
    return this.pluginManager.getAllPlugins()
  }
  async createClientManager(config: ClientManagerConfig) {
    // FIXME if instantiation successful the ClienManager should be added to all client managers
    // we also have to avoid conflicts if one with same name already exists
    return new ClientManager(config)
  }
  /**
   * return the list of client managers i.e.
   * wrapped plugins that specify how to fetch and configure eth binaries
   */
  async getAllClientManagers() {
    await this.whenReady()
    return this.clientManagers
  }
  async getClientManager(name : string) {
    await this.whenReady()
    return this.clientManagers.find(c => c.name === name)
  }
  /**
   * returns a list of **all** clients independent of client managers
   * clients refer to binary+config and a state [running, connected] 
   */
  async getAllClients() {
    await this.whenReady()
    const clientManagers = await this.getAllClientManagers()
    const clients = []
    for (const clientManager of clientManagers) {
      const _clients = await clientManager.getAllClients()
      clients.push(..._clients)
    }
    return clients
  }
  async getClient(clientDefinition: string | ClientManagerConfig, options : any = {}) {
    await this.whenReady()
    options = options
    const spec = options.spec || 'latest'
    const listener = options.listener || undefined

    let clientManager = undefined
    let clientName = '<client name>'
    if (instanceofClientManagerConfig(clientDefinition)) {
      clientManager = await this.createClientManager(clientDefinition)
      clientName = clientDefinition.name
    } else {
      clientName = clientDefinition
      clientManager = await this.getClientManager(clientName)
    }

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
  /**
   * will validate the workflow
   * will return workflow if workflow is available and can be used
   */
  async createWorkflow() {
    throw new Error('not implemented')
  }
  async getAllWorkflows() : Promise<Array<Workflow>> {
    await this.whenReady()
    return this.workflows
  }
  async getWorkflow(workflowName : string) : Promise<Workflow> {
    await this.whenReady()
    const workflows = await this.getAllWorkflows()
    const workflow = workflows.find(w => w.name === workflowName)
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowName}`)
    }
    return workflow
  }
  async reloadWorkflow(...names: Array<string>) {}
  async startApiServer() {
    await this.whenReady()
    const result = await start(this)
    console.log('API ready?', result)
  }
}
