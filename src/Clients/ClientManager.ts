import path from 'path'
import fs from 'fs'
import Client from './Client'
import { PackageManager, IPackage } from 'ethpkg'
import { uuid, resolveRuntimeDependency } from '../util'
import { IRelease } from 'ethpkg/dist/Fetcher/IRepository'

export type ReleaseSpecifier = string

export type StateListener = (newState: string, arg: any) => void

type FilterFunction = (release: IRelease) => boolean

interface FetchClientOptions {
  spec? : ReleaseSpecifier,
  listener?: StateListener 
}

export const CLIENT_FETCH_STATES = {
  RESOLVE_VERSION_STARTED: 'resolve_package_start',
  RESOLVE_VERSION_FINISHED: 'resolve_package_finished',
  DOWNLOAD_STARTED: 'download_started',
  DOWNLOAD_PROGRESS: 'download_progress',
  DOWNLOAD_FINISHED: 'download_finished',
  VERIFICATION_ERROR: 'verification_error',
  VERIFICATION_FAILED: 'verification_failed',
  PACKAGE_WRITTEN: 'package_written',
  BINARY_EXTRACTED: 'binary_extracted',

  PACKAGE_EXTRACTION_STARTED: 'PACKAGE_EXTRACTION_STARTED',
  PACKAGE_EXTRACTION_PROGRESS: 'PACKAGE_EXTRACTION_PROGRESS',
  PACKAGE_EXTRACTION_FINISHED: 'PACKAGE_EXTRACTION_FINISHED',

  RESOLVE_DEPENDENCIES_STARTED: 'RESOLVE_DEPENDENCIES_STARTED',
  RESOLVE_DEPENDENCIES_FINISHED: 'RESOLVE_DEPENDENCIES_FINISHED',

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
  prefix: string;
  binaryName?: string;
  unpack: boolean;
  about?: {
    description?: string;
  };
}

export class ClientManager {

  private _config: ClientManagerConfig
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

  async getClient({
    spec = 'latest', 
    listener = (newState: string, arg: any) => undefined
  } : FetchClientOptions = {}) : Promise<Client> {

    const repo = this.repository
    
    const TEMP = path.join(process.cwd(), 'grid_temp')
    if (!fs.existsSync(TEMP)) {
      fs.mkdirSync(TEMP)
    }

    // FIXME get client package and extract binary here
    const filter = this.filter ? this.createFilter(this.filter) : undefined
    const pkg : IPackage | undefined = await this._packageManager.getPackage({
      spec: `${repo}`,
      listener,
      filter,
      cache: TEMP
    })
    if (!pkg) {
      throw new Error('Could not fetch the package')
    }
    if (pkg.metadata) {
      // TODO fire listener
      const { fileName } = pkg.metadata
      let cachedBinaryPath = path.join(TEMP, fileName)
      // reading and writing to same file can cause issues -> don't attempt overwrite of cached data
      if (!fs.existsSync(cachedBinaryPath)) {
        await pkg.writePackage(cachedBinaryPath)
      }
    }

    if (this.unpack) {

      // FIXME this is not always correct: "name" not always the the package content name
      let name = pkg.metadata && pkg.metadata.name
      let packagePath : string | undefined = name ? path.join(TEMP, name) : undefined
      if (!packagePath || !fs.existsSync(packagePath)) {
        packagePath = undefined
        // client needs to be unpacked
        listener(CLIENT_FETCH_STATES.PACKAGE_EXTRACTION_STARTED, {})
        packagePath = await pkg.extract(TEMP, (progress : number, file: string) => {
          listener(CLIENT_FETCH_STATES.PACKAGE_EXTRACTION_PROGRESS, {
            progress,
            file
          })
        })
        listener(CLIENT_FETCH_STATES.PACKAGE_EXTRACTION_FINISHED, { packageContentsPath: packagePath })
      }

      listener(CLIENT_FETCH_STATES.RESOLVE_DEPENDENCIES_STARTED, {})
      const JAVA_PATH = await resolveRuntimeDependency({
        name: 'Java'
      })
      listener(CLIENT_FETCH_STATES.RESOLVE_DEPENDENCIES_FINISHED, {})

      const binaryPath = JAVA_PATH
      return new Client(binaryPath, this._config, packagePath)
    } else {
      console.log('start extracting binary')
      const binaryPath = await this.extractBinary(pkg, TEMP)
      console.log('binary extracted', binaryPath)
      return new Client(binaryPath, this._config)
    }
  }
}
