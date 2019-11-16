import fs from 'fs'
import path from 'path'
import vm from 'vm'

import { createLogger, LOGLEVEL, isFile, isDir, isUrl } from '../../util'
import IPlugin from './IPlugin';
import { IPackage } from 'ethpkg'
const logger = createLogger(LOGLEVEL.NORMAL)

export default class PluginManager {
  plugins: Array<IPlugin>
  constructor(){
    this.plugins = []
  }
  private async loadPluginFromSource(source: string) : Promise<IPlugin> {
    // FIXME temp fix for clef plugin
    source = source.replace(`const userDataPath = require('electron').app.getPath('userData')`, 'const userDataPath = "C:/Users/Philipp/AppData/Roaming/grid"')
    /**
     * Note that running untrusted code is a tricky business requiring great care. 
     * To prevent accidental global variable leakage, vm.runInNewContext is quite useful, but safely running untrusted code requires a separate process.
     */
    const sandbox = {
      module: { exports: {} }, // plugins want to use module for exports
      process: {
        platform: process.platform,
        env: {
          APPDATA: process.env.APPDATA
        },
      }
    }
    const result = vm.runInNewContext(source, sandbox)
    const { exports: pluginExports } = sandbox.module
    // TODO validate / verify
    if (pluginExports === undefined) {
      throw new Error('Plugin has no exports')
    }
    // @ts-ignore
    const { name } = pluginExports
    return {
      name,
      pluginExports,
      source
    }
  }
  private async loadPluginFromFile(fullPath : string) : Promise<IPlugin> {
    const source = fs.readFileSync(fullPath, 'utf8')
    // const pluginConfig = require(fullPath)
    return this.loadPluginFromSource(source)
  }
  private async loadPluginFromPackage(pluginPkg: IPackage) : Promise<IPlugin> {
    const index = await pluginPkg.getEntry('package/index.js')
    if (!index) {
      throw new Error('Malformed plugin package: "package/index.js" entry not found')
    }
    const source = (await index.file.readContent()).toString()
    // console.log('source', source)
    const plugin = await this.loadPluginFromSource(source)
    return plugin
  }
  private async loadPluginFromUrl(pluginUrl: string) : Promise<IPlugin> {
    // FIXME distinguish between direct link and repo
    // FIXME replace with ethpkg
    /*
    const appManager = new AppManager({
      repository: pluginUrl
    })
    const pluginRelease = await appManager.getRelease({
      version: undefined, // = 'latest'
      download: {
        verifyWith: [{
          "name": "Ryan Ghods",
          "email": "ryan@ethereum.org",
          "address": "0x6ee8d9685eb15e7528282f9e80d2503b23194cc9"
        }]
      }
    })

    if (!pluginRelease || !('data' in pluginRelease)) {
      throw new Error('Plugin could not be found or downloaded')
    }

    if ('verificationResult' in pluginRelease) {
      const { displayName } = pluginRelease
      const { verificationResult } = pluginRelease
      const { isValid, isTrusted } = verificationResult
      if (!isValid) {
        throw new Error(
          `Error: "${displayName}" has invalid plugin signature - unsigned or corrupt?`
        )
      }
      if (!isTrusted) {
        logger.warn(
          `The plugin "${displayName}" is signed but the author's key is unknown.`
        )
      }
    }

    const pluginPkg = await ethpkg.getPackage(pluginRelease.data)

    const plugin = await this.loadPluginFromPackage(pluginPkg)

    return plugin
    */
    throw new Error('not implemented')
  }
  private async scanDir(pluginDir: string) : Promise<Array<IPlugin>> {
    const pluginFiles = fs.readdirSync(pluginDir)
    const plugins : Array<IPlugin> = []
    // if directory contains index.js treat as single plugin directory
    let index = pluginFiles.find((f: string) => f.endsWith('index.js'))
    if (index) {
      let plugin = await this.loadPluginFromFile(path.join(pluginDir, index))
      return [ plugin ]
    }
    let taskName = `Plugin init: ${pluginDir}`
    console.time(taskName)
    for (const f of pluginFiles) {
      if (!f.endsWith('.js')) continue
      try {
        const fullPath = path.join(pluginDir, f)
        const plugin = await this.loadPluginFromFile(fullPath)
        if (!plugin) continue
        plugins.push(plugin)
      } catch (error) {
        if (logger.loglevel <= LOGLEVEL.NORMAL) {
          logger.warn(`Plugin "${f}" could not be loaded: `, error.message)
        } else {
          logger.print(`Plugin "${f}" could not be loaded: `, error)
        }
      }
    }
    console.timeEnd(taskName)
    return plugins
  }
  async scan(...pluginSources: Array<string>) {
    console.log('scan plugin sources', pluginSources)

    let plugins : Array<IPlugin> = []
    for (const pluginSource of pluginSources) {
      try {
        if (await isFile(pluginSource)) {
          const filePlugin = await this.loadPluginFromFile(pluginSource)
          plugins.push(filePlugin)
        }
        else if (await isDir(pluginSource)) {
          const dirPlugins = await this.scanDir(pluginSource)
          plugins = [...plugins, ...dirPlugins]
        }
        else if (await isUrl(pluginSource)) {
          const plugin = await this.loadPluginFromUrl(pluginSource)
          plugins.push(plugin)
        }
        else {
          throw new Error('Plugin source is not a valid file, directory or url')
        }
      } catch (error) {
        logger.warn(`Plugin "${pluginSource}" could not be loaded: `, error.message)
      }
    }

    this.plugins = plugins

    console.log('Initialized', plugins.length, 'plugins: ', plugins.map(p => p.name).join(', '))

    return plugins
  }

  async getAllPlugins() {
    return this.plugins
  }

  async getPlugin(name : string) {
    return this.plugins.find(p => p.name.toLowerCase() === name.toLowerCase())
  }

}