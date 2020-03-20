import { IPackage } from "ethpkg";

export default interface IPlugin {
  readonly pkg?: IPackage; // if plugin is a package this must be set to the package instance
  readonly name: string; // unique identifier
  readonly source : string; // the plugin source
  readonly metadata: any; // the parsed package.json
  readonly pluginExports : any; // the result of executing the plugin (module exports)
}