import path from 'path'
import PluginManager from './PluginSystem/PluginManager'

import { getClientManager } from './Clients/ClientManager'
import { start } from './ApiServer';

const PLUGIN_DIR = path.join(process.cwd(), 'Plugins')

export default class Grid {
  pluginManager: PluginManager;

  constructor(){
    this.pluginManager = new PluginManager()
    // do initial scan for plugins
    // FIXME pluginManager.scan(PLUGIN_DIR)
  }
  async getAllPlugins() {
    await this.pluginManager.scan(PLUGIN_DIR)
    return this.pluginManager.getAllPlugins()
  }
  async getAllClientManagers() {
    await this.pluginManager.scan(PLUGIN_DIR)
    /*
    return this.pluginManager.getAllPlugins()
    */
    return [
      {
        name: 'geth',
        displayName: 'Geth'
      },
      {
        name: 'besu',
        displayName: 'Besu'
      }
    ]
  }
  async getClientManager(name : string) {
    return getClientManager(name, this.pluginManager)
  }
  async startApiServer() {
    const result = await start(this)
    console.log('API ready?', result)
  }
}
