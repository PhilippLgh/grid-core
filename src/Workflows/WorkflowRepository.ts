import fs from 'fs'
import path from 'path'
import IRepository from '../IRepository'
import ethpkg, { IPackage, IRelease } from 'ethpkg'

/**
 * Persistence Layer Abstraction
 */
export default class WorkflowRepository implements IRepository<IRelease, IPackage> {
  constructor(
    private _directoryPath?: string
  ) {}
  private _canAccessDirectory(dir: string | undefined) : dir is string {
    return this._directoryPath !== undefined && fs.existsSync(this._directoryPath)
  }
  public async has(releaseInfo: IRelease) : Promise<boolean> {
    if (!this._canAccessDirectory(this._directoryPath)) {
      return false
    }
    const { fileName } = releaseInfo
    const filePath = path.join(this._directoryPath, fileName || '<unknown>')
    return fs.existsSync(filePath)
  }
  public async get(releaseInfo: IRelease) : Promise<IPackage | undefined> {
    if (!this._canAccessDirectory(this._directoryPath)) {
      return undefined
    }
    const { fileName } = releaseInfo
    const filePath = path.join(this._directoryPath, fileName)
    try {
      return ethpkg.getPackage(filePath)
    } catch (error) {
    }
  }
  public async getAll() : Promise<Array<IPackage>> {
    if (!this._canAccessDirectory(this._directoryPath)) {
      return []
    }
    const files = fs.readdirSync(this._directoryPath)
    const packages : Array<IPackage> = []
    for (const fileName of files) {
      const fullPath = path.join(this._directoryPath, fileName)
      try {
        const pkg = await ethpkg.getPackage(fullPath)
        if (pkg) {
          packages.push(pkg)
        }
      } catch (error) {
        
      }
    }
    return packages
  }
  public async add(workflow: IPackage | undefined) : Promise<boolean> {
    if (!this._canAccessDirectory(this._directoryPath)) {
      return false
    }
    if (!workflow) {
      return false
    }
    const pkgPath = path.join(this._directoryPath, workflow.fileName)
    // TODO handle options
    if (fs.existsSync(pkgPath)) {
      return true
    }
    try {
      await workflow.writePackage(this._directoryPath, {
        overwrite: true
      })
    } catch (error) {
      return false
    }
    return true
  }
  public async delete(releaseInfo: IRelease) : Promise<boolean> {
    if (!this._canAccessDirectory(this._directoryPath)) {
      return false
    }
    const pkg = await this.get(releaseInfo)
    if (!pkg) {
      return false
    }
    if (!pkg.filePath) {
      return false
    }
    fs.unlinkSync(pkg.filePath)
    return true
  }
}