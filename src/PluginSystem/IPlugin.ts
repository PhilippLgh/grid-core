import { IPackage } from "ethpkg";

export default interface IPlugin {
  pkg?: IPackage; // if plugin is a package this must be set to the package instance
  readonly name: string; // unique identifier
  source : string; // the plugin source
  pkgJson: any; // the parsed package.json
  pluginExports : any; // the result of executing the plugin (module exports)
}