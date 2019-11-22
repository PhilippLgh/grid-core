import path from 'path'
import fs from 'fs'
import Client from './Client'
import { PackageManager, IPackage } from 'ethpkg'
import PluginManager from '../PluginSystem/PluginManager'
import { uuid } from '../util'

export type ReleaseSpecifier = string

export type StateListener = (newState: string, arg: any) => void

interface FetchClientOptions {
  spec? : ReleaseSpecifier,
  listener?: StateListener 
}

export class ClientManager {

  private _config: any
  private _packageManager: PackageManager
  id: string

  constructor(config: any) {
    this._config = config
    const { name, repository, filter, prefix } = config
    this._packageManager = new PackageManager()
    this.id = uuid()
  }

  get name() {
    return this._config.name
  }

  get binaryName() {
    return this._config.binaryName
  }

  get description() {
    return this._config.about && this._config.about.description
  }

  async getVersions() {
    return this._packageManager.listPackages('azure:gethstore')
  }

  async getAllClients() {
    return <Array<Client>>[]
  }

  private async extractBinary(pkg : IPackage) {
    const entries = await pkg.getEntries()
    // const entries = await this.updater.getEntries(pkgPathOrUrl)
    if (entries.length === 0) {
      throw new Error('Invalid or empty package')
    }
    let binaryName = this.binaryName
    let binaryEntry = undefined
    if (binaryName) {
      binaryEntry = entries.find((e: any) => e.relativePath.endsWith(binaryName))
    } else {
      // try to detect binary
      console.warn('No "binaryName" specified: trying to auto-detect executable within package')
      // const isExecutable = mode => Boolean((mode & 0o0001) || (mode & 0o0010) || (mode & 0o0100))
      if (process.platform === 'win32') {
        binaryEntry = entries.find((e: any) => e.relativePath.endsWith('.exe'))
      } else {
        // no heuristic available: pick first
        binaryEntry = entries[0]
      }
    }

    if (!binaryEntry) {
      throw new Error(
        'binary not found in package: try to specify binaryName in your plugin'
      )
    } else {
      binaryName = binaryEntry.file.name
      // console.log('auto-detected binary:', binaryName)
    }

    // FIXME use proper caching here
    const destAbs = path.join(process.cwd(), 'temp', binaryName) //path.join(this.cacheDir, binaryName)
    // The unlinking might fail if the binary is e.g. being used by another instance
    if (fs.existsSync(destAbs)) {
      fs.unlinkSync(destAbs)
    }
    // IMPORTANT: if the binary already exists the mode cannot be set
    fs.writeFileSync(
      destAbs,
      await binaryEntry.file.readContent(),
      {
        mode: parseInt('754', 8) // strict mode prohibits octal numbers in some cases
      }
    )

    return destAbs
  }

  async getClient({
    spec = 'latest', 
    listener = (newState: string, arg: any) => undefined
  } : FetchClientOptions = {}) : Promise<Client> {

    // FIXME use proper caching
    let cachedBinaryPath = path.join(process.cwd(), 'temp', 'geth')
    if (fs.existsSync(cachedBinaryPath)) {
      return new Client(cachedBinaryPath, this._config)
    }

    // FIXME use spec to fetch correct client
    // FIXME get client package and extract binary here
    const pkg : IPackage | undefined = await this._packageManager.getPackage({
      spec: 'azure:gethstore',
      listener: (newState, arg) => {
        listener(newState, arg)
        if ('progress' in arg) {
          console.log(`download progress: ${arg.progress}%`)
        } else {
          console.log(newState)
        }
      }
    })
    if (!pkg) {
      throw new Error('Could not fetch the package')
    }
    console.log('start extracting binary')
    const binaryPath = await this.extractBinary(pkg)
    console.log('binary extracted', binaryPath)

    return new Client(binaryPath, this._config)
  }

}

/*
Client Managers are stateful and have uuids they should not be created on the fly
/**
 * Client Manager Factor:
 * creates a ClientManager instance based on a plugin / client name
 * @param name
 /
export const getClientManager = async (name : string, pluginManager: PluginManager) => {
  // TODO await pluginManager.whenReady()
  const plugin = await pluginManager.getPlugin(name)
  if (!plugin) {
    throw new Error(`Plugin "${name}" not found`)
  }
  const { pluginExports: clientConfig } = plugin
  return new ClientManager(clientConfig)
}
*/