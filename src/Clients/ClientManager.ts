import path from 'path'
import fs from 'fs'
import Client from './Client'
import { PackageManager, IPackage, PROCESS_STATES, FetchOptions } from 'ethpkg'
import { uuid, resolveRuntimeDependency } from '../util'
import { IRelease } from 'ethpkg'
import { PROCESS_EVENTS } from '../ProcessEvents'
import { StateListener } from '../StateListener'

export { PROCESS_EVENTS }

type FilterFunction = (release: IRelease) => boolean

// TODO move to utils
const extractPlatformFromString = (str : string) => {
  str = str.toLowerCase() 
  if (str.includes('win32') || str.includes('windows')) {
    return 'windows'
  }
  if (str.includes('darwin') || str.includes('mac') || str.includes('macos')) {
    return 'darwin'
  }
  if (str.includes('linux')) {
    return 'linux'
  }
  return undefined
}

export interface FetchClientOptions {
  platform?: string,
  version?: string,
  onDownloadProgress?: (progress: number, release: IRelease) => void,
  listener?: StateListener,
  cachePath?: string,
  extract?: boolean,
  verify?: boolean
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

  async getVersions(options: FetchOptions = {}) : Promise<Array<IRelease>> {
    const filter = this.filter ? this.createFilter(this.filter) : undefined
    return this._packageManager.listPackages(this.repository, {
      ...options,
      filter
    })
  }

  async resolve(query: string, listener: StateListener) : Promise<IRelease> {
    const filter = this.filter ? this.createFilter(this.filter) : undefined
    throw new Error('not implemented')
    // return this._packageManager.findPackage(spec, { listener, filter })
  }

  private async getPackage({
    version = 'latest',
    platform = process.platform,
    onDownloadProgress = () => {},
    listener = (newState: string, arg: any) => undefined,
    cachePath = this.cachePath,
    extract = false,
    verify = false
  } : FetchClientOptions = {}) : Promise<IPackage | undefined> {

    if (['mac'].includes(platform.toLowerCase())) {
      platform = 'darwin'
    }

    // first, get the package, containing the binaries
    const pkg : IPackage | undefined = await this._packageManager.getPackage(this.repository, {
      // prefix: 'geth-darwin', // server-side processed name- / path-filter. default: undefined
      filter: (release: IRelease) => {
        const _platform = extractPlatformFromString(release.fileName)
        return _platform !== undefined && (_platform === platform)
      },
      version: version === 'latest' ? undefined : version, // specific version or version range that should be returned
      // pagination: true, // if pagination should be used and/or number of pages
      limit: 1000, // number of max results
      // timeout? : number // time in ms for request timeouts.
      // skipCache? : boolean // if cached files should be ignored. default: false 
      cache: cachePath, // user defined path to cache dir(s) where to look for packages 
      // headers
      // proxy
      // onDownloadProgress,
      listener: (newState: string, args: any) => {
        // MAP ethpkg events to grid events and extend them with info
        if (newState === PROCESS_STATES.RESOLVE_PACKAGE_STARTED) {
          const { platform, version} = args
          listener(PROCESS_EVENTS.RESOLVE_RELEASE_STARTED, { platform, version: version || 'latest', name: this.name })
        }
        else if(newState === PROCESS_STATES.RESOLVE_PACKAGE_FINISHED) {
          const { release, platform, version } = args
          listener(PROCESS_EVENTS.RESOLVE_RELEASE_FINISHED, { release, platform, version: version || 'latest', name: this.name })
        } else {
          listener(newState, args)
        }
      },
      destPath: cachePath,
      // metadata: 'detached',
      extract,
      verify
    })

    return pkg
  }

  async getClient({
    version = 'latest',
    platform = process.platform,
    onDownloadProgress = () => {},
    listener = (newState: string, arg: any) => undefined,
    cachePath = this.cachePath,
    extract = false,
    verify = false
  } : FetchClientOptions = {}) : Promise<Client> {

    if (!cachePath) {
      throw new Error('Cannot download client: invalid path provided')
    }

    const pkg = await this.getPackage({
      version,
      platform,
      listener,
      cachePath,
      extract
    })
    if(!pkg) {
      throw new Error('Could not fetch package')
    }

    // TODO we have two ways to verify: package signature and gpg

    // check if the extracted binary exists before extracting it
    // we try to cache binaries with <package name>.<binary extension>
    const { metadata } = pkg
    let { name } = metadata || {}
    if (name) {
      if (process.platform === 'win32') {
        name = name.endsWith('.exe') ? name : `${name}.exe`
      }
      const cachedBinPath = path.join(cachePath, name)
      if (fs.existsSync(cachedBinPath)) {
        return new Client(cachedBinPath, this._config, metadata)
      }
    }

    // extract the binaries from the package OR extract all contents if necessary
    const binaryPath = await this.extractBinary(pkg, cachePath, listener, name)

    const client = new Client(binaryPath, this._config, metadata)
    // FIXME store clients in managed clients
    return client

    /*
    const pkg = await this.getBinaries(cachePath, listener)

    if (this.unpack) {

      // FIXME this is not always correct: "name" not always the the package content name
      let name = pkg.metadata && pkg.metadata.name
      let packagePath : string | undefined = name ? path.join(cachePath, name) : undefined
      if (!packagePath || !fs.existsSync(packagePath)) {
        packagePath = undefined
        // client needs to be unpacked
        listener(PROCESS_EVENTS.PACKAGE_EXTRACTION_STARTED, {})
        packagePath = await pkg.extract(cachePath, (progress : number, file: string) => {
          listener(PROCESS_EVENTS.PACKAGE_EXTRACTION_PROGRESS, {
            progress,
            file
          })
        })
        listener(PROCESS_EVENTS.PACKAGE_EXTRACTION_FINISHED, { packageContentsPath: packagePath })
      }

      listener(PROCESS_EVENTS.RESOLVE_DEPENDENCIES_STARTED, {})
      // FIXME support other runtimes as well
      const JAVA_PATH = await resolveRuntimeDependency({
        name: 'Java'
      })
      listener(PROCESS_EVENTS.RESOLVE_DEPENDENCIES_FINISHED, {})

      const binaryPath = JAVA_PATH
      return new Client(binaryPath, this._config, packagePath)
    } else {
      listener(PROCESS_EVENTS.BINARY_EXTRACTION_STARTED, {})
      const binaryPath = await this.extractBinary(pkg, cachePath)
      listener(PROCESS_EVENTS.BINARY_EXTRACTION_FINISHED, { binaryPath })
      return new Client(binaryPath, this._config)
    }
    */
  }

  async getAllClients() : Promise<Array<Client>> {
    console.log('search for clients at:', this.cachePath)
    return <Array<Client>>[]
  }

  private async extractBinary(pkg : IPackage, destPath: string, listener: StateListener,fileName?: string) {
    const packagePath = pkg.filePath // only set if loaded from cache
    listener(PROCESS_EVENTS.BINARY_EXTRACTION_STARTED, { packagePath })
    const entries = await pkg.getEntries()
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
        'Binary not found in package: try to specify binaryName in your plugin'
      )
    } else {
      binaryName = binaryEntry.file.name
      // console.log('auto-detected binary:', binaryName)
    }

    // FIXME use proper caching here
    // FIXME use content addressing here
    const binaryExtension = path.extname(binaryName)
    // append the correct binary extension to the user fileName if necessary
    if (fileName && !fileName.endsWith(binaryExtension)) {
      fileName += binaryExtension
    }
    const destAbs = path.join(destPath, fileName || binaryName)
    listener(PROCESS_EVENTS.BINARY_EXTRACTION_PROGRESS, { packagePath: pkg.filePath, binaryPathPackage: binaryEntry.relativePath, binaryPathFs: destAbs })
    // The unlinking might fail if the binary is e.g. being used by another instance
    if (fs.existsSync(destAbs)) {
      return destAbs
      // fs.unlinkSync(destAbs)
    }
    // IMPORTANT: if the binary already exists the mode cannot be set
    fs.writeFileSync(
      destAbs,
      await binaryEntry.file.readContent(),
      {
        mode: parseInt('754', 8) // strict mode prohibits octal numbers in some cases
      }
    )
    listener(PROCESS_EVENTS.BINARY_EXTRACTION_FINISHED, { packagePath, binaryPathPackage: binaryEntry.relativePath, binaryPathFs: destAbs })
    return destAbs
  }
}
