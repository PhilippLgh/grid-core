import ISerializable from "../ISerializable"

export default class Workflow implements ISerializable {
  plugin: any

  constructor(plugin : any) {
    this.plugin = plugin
  }

  get name() {
    return this.plugin.name
  }

  get displayName() {
    return this.plugin.displayName || '<unknown>'
  }

  get tags() {
    return this.plugin.tags || []
  }

  async run(config?: any) {

    if (!this.plugin.run) {
      //await _default.run(config)
    } else {
      await this.plugin.run(config)
    }
  }

  toJson(): Promise<string> {
    throw new Error("Method not implemented.");
  }
}