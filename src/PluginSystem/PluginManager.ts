import { promises as fs, existsSync } from 'fs'
import path from 'path'
import vm from 'vm'

import { createLogger, LOGLEVEL, isFile, isDir, isUrl, isDirSync } from '../util'
import IPlugin from './IPlugin';
import { IPackage, PackageManager, instanceofIPackage } from 'ethpkg'
const logger = createLogger(LOGLEVEL.NORMAL)

const pm = new PackageManager()

type PackageJson = {[index:string]: any}

export default class PluginManager {
  plugins: Array<IPlugin>
  createContext: any;
  constructor(createContext: Function, private runSandboxed = true){
    this.plugins = []
    this.createContext = createContext
  }
  private async loadPlugin(source: string, pkgJson: PackageJson, pluginPkg? : IPackage) {

    let pluginExports : any
    /**
     * Note that running untrusted code is a tricky business requiring great care. 
     * To prevent accidental global variable leakage, vm.runInNewContext is quite useful, but safely running untrusted code requires a separate process.
     */
    const originalRequire = require
    const _require = (moduleName: string) => {
      if (moduleName === 'grid-core') {
        // TODO this is not working if not addressed with abs path
        return originalRequire(path.join('grid-core/dist/index.js'))
      }else {
        return originalRequire(moduleName)
      }
    }
    if (this.runSandboxed) {
      const sandbox = this.createContext(pkgJson, pluginPkg)
      /*
      const sandbox = {
        require: _require,
        process,
        console,
        module: {
          exports: {}
        }
      }
      */
      const result = vm.runInNewContext(source, sandbox)
      pluginExports = sandbox.module.exports
    } else {
      const m = require('module')
      const result = vm.runInThisContext(m.wrap(source))(exports, _require, module, __filename, __dirname)
      pluginExports = module.exports
    }

    // TODO validate / verify
    if (pluginExports === undefined) {
      throw new Error('Plugin has no exports')
    }
    // TODO async does probably not work like this: we need to defer the exit until promises resolve
    // TODO what about multiple plugins? process.exit race condition?
    const exitHandler = async () => {
      console.log('WARNING: exit handler called')
      if (typeof pluginExports.onStop === 'function') {
        try {
          await pluginExports.onStop()
        } catch (error) { }
      }
      process.exit()
    }
    process.on('SIGINT', exitHandler)
    process.on('uncaughtException', exitHandler)
    return pluginExports
  }
  private async loadPluginFromSource(source: string, pkgJson?: PackageJson, pluginPkg? : IPackage) : Promise<IPlugin> {
    let pluginExports = await this.loadPlugin(source, pkgJson || {name: '<unknown>'}, pluginPkg)
    if (!pkgJson) {
      // TODO deprecate
      // single-file syntax without package.json
      pkgJson = pluginExports
    }
    if (!pkgJson || !('name' in pkgJson)) {
      throw new Error('Plugin has no name')
    }
    const { name } = pkgJson
    return {
      name,
      pkgJson,
      pluginExports,
      source
    }
  }
  /*
  private async loadPluginFromFile(fullPath : string) : Promise<IPlugin> {
    const source = await fs.readFile(fullPath, 'utf8')
    // const pluginConfig = require(fullPath)
    return this.loadPluginFromSource(source)
  }
  */
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

    const packageJsonEntry = await pluginPkg.getEntry('package.json')
    if(!packageJsonEntry) {
      throw new Error('Malformed plugin package: "package.json" entry not found')
    }

    const pkgJsonBuf = await packageJsonEntry.file.readContent()
    const pkgJson = JSON.parse(pkgJsonBuf.toString())

    const source = (await index.file.readContent()).toString()
    // console.log('source', source)
    const plugin = await this.loadPluginFromSource(source, pkgJson, pluginPkg)
    plugin.pkg = pluginPkg
    return plugin
  }
  private async loadPluginFromDir(dirPath: string) : Promise<IPlugin | undefined> {
    const pluginFiles = await fs.readdir(dirPath)
    let index = pluginFiles.find((f: string) => f.endsWith('index.js'))
    let pkgJsonFile = pluginFiles.find((f: string) => f.endsWith('package.json'))
    if (!index || !pkgJsonFile) {
      return undefined
    }
    // convert plugin dir to package first - important for docker support
    // console.time('create pkg: '+dirPath)
    const pkg = await pm.createPackage(dirPath)
    // console.timeEnd('create pkg: '+dirPath)
    return this.loadPluginFromPackage(pkg)
  }
  private async loadPluginFromUrl(pluginUrl: string) : Promise<IPlugin> {
    throw new Error('not implemented')
  }
  public async tryLoad(fullFilePathOrUrl: string) {
    try {
      // console.log('load plugin from', fullFilePathOrUrl)
      if (await isFile(fullFilePathOrUrl)) {
        // TODO deprecate
        const content = await fs.readFile(fullFilePathOrUrl)
        const plugin = await this.loadPluginFromSource(content.toString(), undefined)
        return plugin
      }
      else if (await isDir(fullFilePathOrUrl)) {
        const plugin = await this.loadPluginFromDir(fullFilePathOrUrl)
        return plugin
      }
      else if (await isUrl(fullFilePathOrUrl)) {
        const plugin = await this.loadPluginFromUrl(fullFilePathOrUrl)
        return plugin
      }
      else {
        throw new Error('Plugin source is not a valid file, directory or url')
      }
    } catch (error) {
      logger.warn(`Plugin "${fullFilePathOrUrl}" could not be loaded: `, error.message)
      return undefined
    }
  }
  private async scanDir(pluginDir: string) : Promise<Array<IPlugin>> {
    const pluginFiles = await fs.readdir(pluginDir)
    const plugins : Array<IPlugin> = []

    // try to load as single plugin dir
    let plugin = await this.loadPluginFromDir(pluginDir)
    if (plugin) {
      return [ plugin ]
    }
    // else: scan all subdirs
    let taskName = `Plugin init: ${pluginDir}`
    // console.time(taskName)
    for (const f of pluginFiles) {
      try {
        let fullPath = path.join(pluginDir, f)
        if (await isDir(fullPath)) {
          let _plugins = await this.scanDir(fullPath)
          plugins.push(..._plugins)
        }
      } catch (error) {
        if (logger.loglevel <= LOGLEVEL.NORMAL) {
          logger.warn(`Plugin "${f}" could not be loaded: `, error.message)
        } else {
          logger.print(`Plugin "${f}" could not be loaded: `, error)
        }
      }
    }
    // console.timeEnd(taskName)
    // console.log('return plugins', plugins.map(p => p.name))
    return plugins
  }
  async scan(...pluginSources: Array<string>) {
    let plugins : Array<IPlugin> = []
    for (const pluginSource of pluginSources) {
      const plugin = await this.tryLoad(pluginSource)
      if  (plugin) {
        plugins.push(plugin)
      }
    }
    this.plugins = plugins
    return plugins
  }

  async load(pluginDirOrPkg: string | IPackage) : Promise<IPlugin> {
    if (instanceofIPackage(pluginDirOrPkg)) {
      return this.loadPluginFromPackage(pluginDirOrPkg)
    } else if (isDirSync(pluginDirOrPkg)) {
      let plugin = await this.loadPluginFromDir(pluginDirOrPkg)
      if (plugin) {
        return plugin
      }
    }
    throw new Error('Could not load plugin')
  }

  async getAllPlugins() {
    return this.plugins
  }

  async getPlugin(name : string) {
    return this.plugins.find(p => p.name.toLowerCase() === name.toLowerCase())
  }

}