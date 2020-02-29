import ISerializable from "../ISerializable"
import IPlugin from "../PluginSystem/IPlugin"

export default class Workflow implements ISerializable {
  pluginExports: any
  meta: any

  constructor(plugin : IPlugin) {
    this.pluginExports = plugin.pluginExports
    this.meta = plugin.pkgJson
  }

  get name() {
    return this.meta.name
  }

  get displayName() {
    return this.meta.displayName || '<unknown>'
  }

  get version() {
    return this.meta.version
  }

  get description() {
    return this.meta.description
  }

  get tags() {
    return this.pluginExports.tags || []
  }

  get exports() {
    return this.pluginExports.exports
  }

  private async exitWorkflow(error?: Error) {
    if (this.pluginExports.onStop) {
      try {
        await this.pluginExports.onStop()
      } catch (error) {
        // TODO log problems in stop
      }
    }
    if (error) {
      console.error(`Error in workflow "${this.name}":`, error)
      throw error
    }
  }

  async run(config?: any) {
    if (!this.pluginExports.run) {
      //await _default.run(config)
    } else {
      if (typeof this.pluginExports.run.fn === 'function') {
        try {
          return await this.pluginExports.run.fn(config)
        } catch (error) {
          await this.exitWorkflow(error)
        }
      }
      try {
        return await this.pluginExports.run(config)
      } catch (error) {
        await this.exitWorkflow(error)
      }
    }
  }

  toJson(): Promise<string> {
    throw new Error("Method not implemented.");
  }
}