import { promises as fs, existsSync } from 'fs'
import path from 'path'
import vm from 'vm'

import { createLogger, LOGLEVEL, isFile, isDir, isUrl } from '../util'
import IPlugin from './IPlugin';
import { IPackage, PackageManager } from 'ethpkg'
const logger = createLogger(LOGLEVEL.NORMAL)

export default class PluginManager {
  plugins: Array<IPlugin>
  createContext: any;
  constructor(createContext: Function){
    this.plugins = []
    this.createContext = createContext
  }
  private async loadPluginFromSource(source: string, pluginPkg? : IPackage) : Promise<IPlugin> {
    // FIXME temp fix for clef plugin
    source = source.replace(`const userDataPath = require('electron').app.getPath('userData')`, 'const userDataPath = "C:/Users/Philipp/AppData/Roaming/grid"')
    /**
     * Note that running untrusted code is a tricky business requiring great care. 
     * To prevent accidental global variable leakage, vm.runInNewContext is quite useful, but safely running untrusted code requires a separate process.
     */
    const sandbox = this.createContext(pluginPkg)

    const result = vm.runInNewContext(source, sandbox)
    const { exports: pluginExports } = sandbox.module
    // TODO validate / verify
    if (pluginExports === undefined) {
      throw new Error('Plugin has no exports')
    }
    if (!('name' in pluginExports)) {
      throw new Error('Plugin has no name')
    }
    const { name } = pluginExports
    return {
      name,
      pluginExports,
      source
    }
  }
  private async loadPluginFromFile(fullPath : string) : Promise<IPlugin> {
    const source = await fs.readFile(fullPath, 'utf8')
    // const pluginConfig = require(fullPath)
    return this.loadPluginFromSource(source)
  }
  private async loadPluginFromPackage(pluginPkg: IPackage) : Promise<IPlugin> {
    const indexNPM = await pluginPkg.getEntry('package/index.js')
    if (indexNPM) {
      console.log('WARNING: Plugins should not be packaged with NPM anymore. And will become invalid in the future.')
    }
    const indexReg = await pluginPkg.getEntry('index.js')
    const index = indexNPM || indexReg
    if (!index) {
      throw new Error('Malformed plugin package: "package/index.js" entry not found')
    }
    const source = (await index.file.readContent()).toString()
    // console.log('source', source)
    const plugin = await this.loadPluginFromSource(source, pluginPkg)
    plugin.pkg = pluginPkg
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
    const pluginFiles = await fs.readdir(pluginDir)
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
      try {
        let fullPath = path.join(pluginDir, f)
        let plugin = undefined
        if (await isDir(fullPath)) {
          // TODO allow recursive scanning of nested non-plugin-dirs
          if (!(await existsSync(path.join(fullPath, 'index.js')))) {
            continue
          }
          // convert plugin dir to package first - important for docker support
          const pm = new PackageManager()
          const tar = await pm.createPackage(fullPath)
          plugin = await this.loadPluginFromPackage(tar)
        } else {
          if (!fullPath.endsWith('.js')) continue
          plugin = await this.loadPluginFromFile(fullPath)
        }
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

    return plugins
  }

  async getAllPlugins() {
    return this.plugins
  }

  async getPlugin(name : string) {
    return this.plugins.find(p => p.name.toLowerCase() === name.toLowerCase())
  }

}