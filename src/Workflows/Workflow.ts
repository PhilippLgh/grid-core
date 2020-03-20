import ISerializable from '../ISerializable'
import { WorkflowInfo } from './WorkflowInfo'
import { uuid } from '../util'
import { IPackage } from 'ethpkg'
import { Plugin } from '../PluginSystem/Plugin'
import Job from './Job'

const capitalizeFirstLetter = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

const toDisplayName = (name: string) => name.split(/[-_]+/g).map(capitalizeFirstLetter).join(' ')

// special job id that indicates that a resource such as client was created without being associated
// to a specific job
export const JOB_ID_UNKNOWN = '<unemployed>'

export default class Workflow implements ISerializable {
  private readonly pluginExports: any
  private readonly meta: any
  private readonly _id: string
  _pkg: IPackage | undefined

  constructor(private readonly _plugin : Plugin, private _isInstalled = false) {
    this.meta = _plugin.metadata
    this._pkg = _plugin.pkg
    this._id = `id:${uuid()}`
  }

  get pkg() {
    return this._pkg
  }

  get id() {
    return this._id
  }

  get name() {
    return this.meta.name
  }

  get displayName() {
    return this.meta.displayName || toDisplayName(this.name)
  }

  get version() {
    return this.meta.version
  }

  get description() {
    return this.meta.description
  }

  info() : WorkflowInfo {
    return {
      id: `infoId:${uuid()}`,
      workflowId: this.id,
      name: this.name,
      displayName: this.displayName,
      version: this.version,
      // TODO set specifier
      specifier: undefined,
      isInstalled: this._isInstalled,
    }
  }

  async run(flags: any = {}) : Promise<Job> {
    const job = new Job(
      this._plugin,
      this.info()
    )
    job.run(flags)
    return job
  }

  toJson(): Promise<string> {
    throw new Error("Method not implemented.");
  }
}