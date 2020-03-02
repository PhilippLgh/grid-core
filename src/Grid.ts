import path from 'path'
import fs from 'fs'
import { EventEmitter } from 'events'
import PluginManager from './PluginSystem/PluginManager'
import { ClientManager, PROCESS_EVENTS, ClientManagerConfig, FetchClientOptions } from './Clients/ClientManager'
import { start } from './ApiServer'
import { startAppServer } from './AppServer/index'
import { WORKFLOW_TAGS, PLUGIN_TYPES } from './constants'
import { createContext } from './PluginContext'
import Workflow from './Workflows/Workflow'
import DockerClientManager from './Clients/DockerClientManager'
import { IPackage, PackageManager, GetKeyOptions } from 'ethpkg'
import { appDataPath, createLogger, LOGLEVEL, isDirSync, isUrl } from './util'
import IPlugin from './PluginSystem/IPlugin'
import Client, { ClientStartOptions } from './Clients/Client'
import WorkflowManager, { PublishWorkflowOptions, GetWorkflowOptions, CreateWorkflowOptions } from './Workflows/WorkflowManager'
import open from 'open'
import { ChildProcess } from 'child_process'
import { StateListener } from './StateListener'
import { Flags } from './Clients/Flags'
const logger = createLogger(LOGLEVEL.NORMAL)

const PLUGIN_DIR = path.join(__dirname, '..', 'Plugins')

export { WORKFLOW_TAGS, PLUGIN_TYPES, PROCESS_EVENTS }

export function instanceofClientManagerConfig(object: any): object is ClientManagerConfig {
  return typeof object === 'object' && ('repository' in object)
}

class WebApp extends EventEmitter {
  constructor(public serverUrl: string, proc: ChildProcess) {
    super()
    proc.on('close', () => this.emit('close'))
    proc.on('exit', () => this.emit('close'))
  }
}

const findConfig = async (dirPath: string) : Promise<string | undefined> => {
  const parent = path.join(dirPath, '..')
  const configPath = path.join(dirPath, '.grid.config.js')
  if (fs.existsSync(configPath)) {
    return configPath
  }
  if (!parent || parent === dirPath) {
    return undefined
  } 
  return findConfig(parent)
}

const readConfig = (configPath: string) => {
  // the dir containing the config can be considered a workspace
  const workspaceDir = path.join(configPath, '..')
  const config = require(configPath)
  const validKeys = ['keystore', 'key_alias', 'sandbox_plugins', 'repository', 'cachepath', 'author', 'license', 'trusted']
  const invalidKeys = Object.keys(config).filter(k => !validKeys.includes(k))
  if (invalidKeys.length > 0) {
    console.warn('WARNING', 'config contains invalid keys', invalidKeys)
  }
  // resolve releative paths like . or ./cache relatively to workspace, containing config
  if (config.keystore) {
    config.keystore = path.resolve(workspaceDir, config.keystore)
  }
  if (config.cachepath) {
    config.cachepath = path.resolve(workspaceDir, config.cachepath)
  }
  return config
}

export interface ILogger {
  listener: StateListener
}

export interface GridOptions {
  logger?: ILogger
}

class SilentLogger implements ILogger {
  listener = () => {
  }
}

export default class Grid extends EventEmitter {
  pluginManager: PluginManager;
  clientManagers: Array<ClientManager>;
  isReady: boolean;
  workflowManager: WorkflowManager
  config: { [index: string]: any } = {}
  logger: ILogger
  constructor(options: GridOptions = {}){
    super()
    this.pluginManager = new PluginManager(createContext(this))
    this.workflowManager = new WorkflowManager(this.pluginManager)
    this.clientManagers = []
    this.isReady = false
    this.logger = options.logger || new SilentLogger()
    this.init().catch(error => {
      // FIXME somehow init errors get swallowed during workflow execution
      console.error('Cannot initialize Grid:', error)
      throw new Error('Cannot initialize Grid')
    })
  }
  // should only be called one -> private
  private async init() {
    let cachePath = await appDataPath('cache')
    let keyStorePath = await appDataPath('keys') 
    let configPath
    try {
      configPath = await findConfig(process.cwd())
    } catch (error) {
      console.log('Error in findConfig()', error)
    }
    let config = {}
    if (configPath && fs.existsSync(configPath)) {
      try {
        config = readConfig(configPath)
        console.log('Grid uses configuration:', configPath, '\n')
      } catch (error) {
        console.log('Error in readConfig()', error)
      }
    }
    const defaults = {
      keystore: keyStorePath,
      cachepath: cachePath
    }
    // console.log('creating config', defaults, config)
    this.config = Object.assign(defaults, (config || {}))

    this.isReady = true
    this.emit('ready')

  }

  setLogger(logger?: ILogger) {
    this.logger = logger || new SilentLogger()
  }

  async getCachePath() {
    await this.whenReady()
    return this.config.cachepath
  }

  /**
   * Instead of making this public and having
   * implementers worry about lifecycle or forget to wait about init
   * we should keep this private and just wait in methods were information
   * from init is required
   */
  private whenReady(timeout?: number) {
    if (this.isReady) return Promise.resolve()
    return new Promise((resolve, reject) => {
      this.once('ready', resolve)
    })
  }
  /**
   * returns the list of all evaluated plugin exports
   * i.e. the configuration they produce when run on this machine
   */
  async getAllPlugins() : Promise<Array<IPlugin>> {
    await this.whenReady()
    return this.pluginManager.getAllPlugins()
  }
  async createClientManager(config: ClientManagerConfig, pluginCtx?: IPackage) : Promise<ClientManager> {
    // FIXME if instantiation successful the ClientManager should be added to all client managers
    // we also have to avoid conflicts if one with same name already exists
    const { repository } = config
    if (repository.startsWith('docker:') || 'docker' in config) {
      // TODO handle throws Docker not running
      return new DockerClientManager(config, pluginCtx)
    }
    return new ClientManager({
      ...config,
      cachePath: await this.getCachePath()
    })
  }
  /**
   * return the list of client managers i.e.
   * wrapped plugins that specify how to fetch and configure eth binaries
   */
  async getAllClientManagers() : Promise<Array<ClientManager>>{
    await this.whenReady()
    return this.clientManagers
  }
  async getClientManager(name : string) : Promise<ClientManager | undefined> {
    await this.whenReady()
    return this.clientManagers.find(c => c.name === name)
  }
  /**
   * returns a list of **all** clients independent of client managers
   * clients refer to binary+config and a state [running, connected] 
   */
  async getAllClients() : Promise<Array<Client>> {
    await this.whenReady()
    const clientManagers = await this.getAllClientManagers()
    const clients = []
    for (const clientManager of clientManagers) {
      const _clients = await clientManager.getAllClients()
      clients.push(..._clients)
    }
    return clients
  }

  async getClient(clientManagerSpec: string | ClientManagerConfig, options : FetchClientOptions = {}) : Promise<Client | undefined> {
    await this.whenReady()

    options = {
      listener: this.logger.listener,
      ...options
    }

    let clientManager = undefined
    let clientName = '<client name>'

    // FIXME use specifier validation instead of `docker:`
    if (typeof clientManagerSpec === 'string' && clientManagerSpec.startsWith('docker:')) {
      // if string is valid specifier allow to create ClientManager on the fly
      // expand string to ClientManagerConfig
      // 'docker:local/ewasm'
      clientManagerSpec = {
        name: (clientManagerSpec.split('/')).pop() || '<unknown>',
        repository: clientManagerSpec
      } as ClientManagerConfig
    }

    if (instanceofClientManagerConfig(clientManagerSpec)) {
      clientManager = await this.createClientManager(clientManagerSpec)
      clientName = clientManagerSpec.name
      if (clientManager) {
        this.clientManagers.push(clientManager)
      }
    } else {
      clientName = clientManagerSpec
      clientManager = await this.getClientManager(clientName)
      if (!clientManager) {
        if (clientName === 'geth') {
          // TODO load from remote
          let gethPlugin = await this.pluginManager.tryLoad(path.join(PLUGIN_DIR, 'geth.js'))
          if (gethPlugin) {
            clientManager = await this.createClientManager(gethPlugin.pluginExports)
            this.clientManagers.push(clientManager)
          }
        }
      }
    }

    if (!clientManager) {
      const available = (await this.getAllClientManagers()) || []
      throw new Error(`Client "${clientName}" is not supported or found. Try adding a plugin. Available plugins: [${available.map(r => r.name)}]`)
    }

    const client = await clientManager.getClient(options)
    return client
  }

  async startClient(client: Client) : Promise<string | undefined>
  async startClient(client: Client, flags: Array<string>, options?: ClientStartOptions) : Promise<string | undefined>
  async startClient(client: Client, flags: Flags, options?: ClientStartOptions) : Promise<string | undefined>
  async startClient(client: Client, flags?: Array<string> | Flags, options: ClientStartOptions = {}) : Promise<string | undefined> {
    if (!client || !client.name) {
      throw new Error('First argument must be client: Grid.startClient(client, flags, options)')
    }
    if (!flags) {
      return this.startClient(client, new Flags())
    }
    if (flags instanceof Flags) {
      return this.startClient(client, flags.toProcessFlags(), options)
    }
    if (!Array.isArray(flags)) {
      throw new Error('Bad argument flags:'+ typeof flags)
    }
    options = {
      listener: this.logger.listener,
      ...options
    }
    return client.start(flags, options)
  }

  async stopClient(client: Client) {
    return client.stop()
  }

  async stopClients(...clients: Client[]) {
    // FIXME needs implementation
    if (clients.length === 0) {

    }
    const managers = await this.getAllClientManagers()

  }

  /**
   * This will return an unlocked key if it can be found in keystore
   * If not it can create a new one
   * @param options 
   */
  async getSigningKey(options?: GetKeyOptions) {
    await this.whenReady()
    if (options) {
      options.keyStore = options.keyStore || this.config.keystore
    }
    const key = await new PackageManager().getSigningKey(options)
    return key
  }

  async createWorkflow(options : CreateWorkflowOptions) : Promise<string> {
    await this.whenReady()
    options.author = options.author || this.config.author
    options.license = options.license || this.config.license
    return this.workflowManager.createWorkflow(options)
  }

  async loadWorkflow(workflowPathOrPkg: string | IPackage) : Promise<Workflow> {
    return this.workflowManager.loadWorkflow(workflowPathOrPkg)
  }

  async getAllWorkflows() : Promise<Array<Workflow>> {
    return this.workflowManager.getAllWorkflows()
  }

  async getWorkflow(workflowSpec : string, options?: GetWorkflowOptions) : Promise<Workflow | undefined> {
    return this.workflowManager.getWorkflow(workflowSpec, options)
  }

  async publishWorkflow(workflowPath: string, options?: PublishWorkflowOptions) {
    return this.workflowManager.publishWorkflow(workflowPath, options)
  }

  async startWebApp(queryOrUrl: string, {
    listener = this.logger.listener
  }: any = {}) {

    let serverUrl
    if(await isUrl(queryOrUrl)) {
      console.log('open url', queryOrUrl)
      serverUrl = queryOrUrl
    } 
    // if package query start a new server for package
    else {
      const pm = new PackageManager()
      const appCache = path.join(await this.getCachePath(), 'apps')
      const appPkg = await pm.getPackage(queryOrUrl, {
        listener,
        cache: appCache
      })
      if (!appPkg) {
        throw new Error(`App not found: "${queryOrUrl}"`)
      }
      serverUrl = await startAppServer(appPkg, {
        listener,
      })
    }

    // consider customizing args like:
    // https://github.com/puppeteer/puppeteer/blob/0b1a9ceee2f05f534f0d50079ece172d627a93c7/lib/Launcher.js
    const proc = await open(serverUrl)
    const app = new WebApp(serverUrl, proc)
    // TODO call listener

  }

  async startApiServer() : Promise<void> {
    await this.whenReady()
    const result = await start(this)
    logger.log('API ready?', result)
  }
}
