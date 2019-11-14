import path from 'path'
import fs from 'fs'
import PluginManager from '../PluginSystem/PluginManager'
import Client from './Client'
import { PackageManager, IPackage } from 'ethpkg'

export type ReleaseSpecifier = string

class ClientManager {

  config: any
  packageManager: PackageManager

  constructor(config: any) {
    this.config = config
    const { name, repository, filter, prefix } = config
    this.packageManager = new PackageManager()
  }

  get binaryName() {
    return this.config.binaryName
  }

  async listClients() {

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

  async getClient(spec? : ReleaseSpecifier) : Promise<Client> {

    // FIXME use proper caching
    let cachedBinaryPath = path.join(process.cwd(), 'temp', 'geth')
    if (fs.existsSync(cachedBinaryPath)) {
      return new Client(cachedBinaryPath, this.config)
    }

    // FIXME get client package and extract binary here
    const pkg : IPackage | undefined = await this.packageManager.getPackage('azure:gethstore', {
      listener: (newState, arg) => {
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

    return new Client(binaryPath, this.config)
  }

}

const pluginManager = new PluginManager()
const PLUGIN_DIR = path.join(process.cwd(), 'Plugins')
console.log('plugin dir', PLUGIN_DIR)
// do initial scan for plugins
// FIXME pluginManager.scan(PLUGIN_DIR)

/**
 * Client Manager Factor:
 * creates a ClientManager instance based on a plugin / client name
 * @param name
 */
export const getClientManager = async (name : string) => {
  // TODO await pluginManager.whenReady()
  await pluginManager.scan(PLUGIN_DIR)
  const plugin = await pluginManager.getPlugin(name)
  if (!plugin) {
    throw new Error('plugin not found')
  }
  const { pluginExports: clientConfig } = plugin
  return new ClientManager(clientConfig)
}