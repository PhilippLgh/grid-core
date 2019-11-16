export default interface IPlugin {
  readonly name: string; // unique identifier
  source : string; // the plugin source
  pluginExports : any; // the result of executing the plugin (module exports)
}