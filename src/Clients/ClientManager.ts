import path from 'path'
import fs from 'fs'
import Client from './Client'
import { PackageManager, IPackage } from 'ethpkg'
import { uuid, resolveRuntimeDependency } from '../util'
import { IRelease } from 'ethpkg/dist/Fetcher/IRepository'
import { INIT_CLIENT_EVENTS } from './InitClientEvents'

export { INIT_CLIENT_EVENTS }

export type ReleaseSpecifier = string

export type StateListener = (newState: string, arg: any) => undefined | void

type FilterFunction = (release: IRelease) => boolean

export interface FetchClientOptions {
  spec? : ReleaseSpecifier,
  listener?: StateListener 
}


export interface ClientManagerConfig {
  name: string;
  repository: string;
  filter?: {
    name: {
      includes?: Array<string>;
      exclude?: Array<string>;
    }
  };
  prefix?: string;
  binaryName?: string;
  unpack?: boolean;
  about?: {
    description?: string;
  };
  cachePath?: string; // this is set by Grid not by the plugin
}

export class ClientManager {

  protected _config: ClientManagerConfig
  private _packageManager: PackageManager
  id: string

  constructor(config: ClientManagerConfig) {
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

  get cachePath() {
    return this._config.cachePath as string
  }

  get description() {
    return this._config.about && this._config.about.description
  }

  get repository() {
    return this._config.repository
  }

  get filter() {
    return this._config.filter
  }

  get unpack() {
    return this._config.unpack === true
  }

  private createFilter = (filterConfig: any) : FilterFunction => {
    if (!filterConfig || !('name' in filterConfig)) {
      return (() => true)
    }
    const { name } = filterConfig
    const includes : Array<string> = name.includes || []
    const excludes: Array<string> = name.excludes || []
    return ({ fileName, version } : any) => {
      if (!fileName) {
        return false
      }
      fileName = fileName.toLowerCase()
      return (
        (!includes || includes.every(val => fileName.indexOf(val) >= 0)) &&
        (!excludes || excludes.every(val => fileName.indexOf(val) === -1))
      )
    }
  }

  async getVersions() {
    const filter = this.filter ? this.createFilter(this.filter) : undefined
    return this._packageManager.listPackages(this.repository, {
      filter
    })
  }

  async resolve(spec: string, listener: StateListener) {
    const filter = this.filter ? this.createFilter(this.filter) : undefined
    return this._packageManager.findPackage(spec, { listener, filter })
  }

  async getAllClients() {
    return <Array<Client>>[]
  }

  private async extractBinary(pkg : IPackage, destPath: string) {
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
    // FIXME use content addressing here
    const destAbs = path.join(destPath, binaryName) //path.join(this.cacheDir, binaryName)
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

  // TODO make private
  async getBinaries(
    cacheDir: string,
    listener: StateListener,
  ) {
    const repo = this.repository

    // FIXME get client package and extract binary here
    const filter = this.filter ? this.createFilter(this.filter) : undefined
    const pkg : IPackage | undefined = await this._packageManager.getPackage({
      spec: `${repo}`,
      listener,
      filter,
      cache: cacheDir
    })
    if (!pkg) {
      throw new Error('Could not fetch the package')
    }
    if (pkg.metadata) {
      // TODO fire listener
      const { fileName } = pkg.metadata
      let cachedBinaryPath = path.join(cacheDir, fileName)
      // reading and writing to same file can cause issues -> don't attempt overwrite of cached data
      if (!fs.existsSync(cachedBinaryPath)) {
        await pkg.writePackage(cachedBinaryPath)
      }
    }

    return pkg
  }

  async getClient({
    spec = 'latest', 
    listener = (newState: string, arg: any) => undefined
  } : FetchClientOptions = {}) : Promise<Client> {

    const cache = this.cachePath
    const pkg = await this.getBinaries(cache, listener)

    if (this.unpack) {

      // FIXME this is not always correct: "name" not always the the package content name
      let name = pkg.metadata && pkg.metadata.name
      let packagePath : string | undefined = name ? path.join(cache, name) : undefined
      if (!packagePath || !fs.existsSync(packagePath)) {
        packagePath = undefined
        // client needs to be unpacked
        listener(INIT_CLIENT_EVENTS.PACKAGE_EXTRACTION_STARTED, {})
        packagePath = await pkg.extract(cache, (progress : number, file: string) => {
          listener(INIT_CLIENT_EVENTS.PACKAGE_EXTRACTION_PROGRESS, {
            progress,
            file
          })
        })
        listener(INIT_CLIENT_EVENTS.PACKAGE_EXTRACTION_FINISHED, { packageContentsPath: packagePath })
      }

      listener(INIT_CLIENT_EVENTS.RESOLVE_DEPENDENCIES_STARTED, {})
      // FIXME support other runtimes as well
      const JAVA_PATH = await resolveRuntimeDependency({
        name: 'Java'
      })
      listener(INIT_CLIENT_EVENTS.RESOLVE_DEPENDENCIES_FINISHED, {})

      const binaryPath = JAVA_PATH
      return new Client(binaryPath, this._config, packagePath)
    } else {
      listener(INIT_CLIENT_EVENTS.BINARY_EXTRACTION_STARTED, {})
      const binaryPath = await this.extractBinary(pkg, cache)
      listener(INIT_CLIENT_EVENTS.BINARY_EXTRACTION_FINISHED, { binaryPath })
      return new Client(binaryPath, this._config)
    }
  }
}
