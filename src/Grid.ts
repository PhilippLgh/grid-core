import path from 'path'
import PluginManager from './PluginSystem/PluginManager'

import { getClientManager, StateListener } from './Clients/ClientManager'
import { start } from './ApiServer';

const PLUGIN_DIR = path.join(process.cwd(), 'Plugins')

export default class Grid {
  pluginManager: PluginManager;

  constructor(){
    this.pluginManager = new PluginManager()
    // do initial scan for plugins
    // FIXME pluginManager.scan(PLUGIN_DIR)
  }
  async pluginsReady() {
    await this.pluginManager.scan(PLUGIN_DIR)
    return true
  }
  async getAllPlugins() {
    return this.pluginManager.getAllPlugins()
  }
  async getAllClientManagers() {
    return await this.pluginManager.plugins // TODO filter by plugin type
  }
  async getClientManager(name : string) {
    return getClientManager(name, this.pluginManager)
  }
  async getClient(clientName: string, listener?: StateListener) {
    await this.pluginsReady()
    const clientManager = await this.getClientManager(clientName)
    const client = await clientManager.getClient({
      listener
    })
    return client
  }
  async startApiServer() {
    const result = await start(this)
    console.log('API ready?', result)
  }
}
