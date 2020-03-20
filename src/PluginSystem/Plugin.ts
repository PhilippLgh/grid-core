import path from 'path'
import vm from 'vm'

import IPlugin from './IPlugin'
import { IPackage } from 'ethpkg'
import { StringMap } from '../BaseTypes'

export class Plugin implements IPlugin {
  pluginExports: any;
  constructor (
    private readonly _source : string,  // index.js
    private readonly _metadata : StringMap, // package.json
    readonly pkg? : IPackage  // other resources from package if available
  ) {

  }
  get name() {
    return this._metadata.name
  }
  get version() {
    return this._metadata.version
  }
  get source() {
    return this._source
  }
  get metadata() {
    return this._metadata
  }
  public async init(sandbox?: any, _require: Function = require) : Promise<any> {
    if (sandbox) {
      const result = vm.runInNewContext(this.source, sandbox, {
        filename: '<workflow>/index.js',
        displayErrors: true
      })
      this.pluginExports = sandbox.module.exports
    } else {
      const m = require('module')
      // note that this will fail for grid workflow as they require 'grid-core' which is most likely not available
      const result = vm.runInThisContext(m.wrap(this.source))(exports, _require, module, __filename, __dirname)
      this.pluginExports = module.exports
    }
    if (this.pluginExports === undefined) {
      throw new Error('Plugin has no exports')
    }
    return this.pluginExports
  }
}