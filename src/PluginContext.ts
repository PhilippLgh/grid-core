import { printFetchStateToCLI } from './Bin/cli-utils'

// warning circular dependency
import Grid, { GLOBAL_SETTINGS, WORKFLOW_TAGS, PLUGIN_TYPES } from './Grid'
import { IPackage } from 'ethpkg'

const oneOf = (arg: any) => { return arg}
const multiSelect = (arg: any) => { return arg}

export const createContext = (grid: Grid, insecure = false) => {
  // context needs to be a new one for each plugin
  // therefore we use a factory
  return (pluginResources : IPackage) => {

    // intercept calls to grid instance (beware singleton!) and augment them with plugin context if necessary
    let handler = {
      get(target: any, methodName: any, receiver: any) {
        const origMethod = target[methodName];
        if (typeof origMethod === 'function') {
          // @ts-ignore
          return function (...args) {
            if (methodName === 'createClientManager') {
              args.push(pluginResources)
            }
            // @ts-ignore
            return origMethod.apply(this, args)
          };
        }
        return origMethod
      }
    };

    const sandbox = {
      process: {
        platform: process.platform,
        env: {
          APPDATA: process.env.APPDATA
        },
      },
      console,
      printFetchStateToCLI,
      // TODO allow insecure mode where require is available
      require: (name: string) => {
        // console.log('require called', name)
        if (name === 'grid-core') {
          return new Proxy(grid, handler)
        }
        if (name === 'grid-core/constants/workflow_tags') {
          return WORKFLOW_TAGS
        }
        if (name === 'grid-core/constants/plugin_types') {
          return PLUGIN_TYPES
        }
        if (name === 'grid-core/settings') {
          return {
            oneOf,
            multiSelect,
            GLOBAL_SETTINGS
          }
        }
        if (insecure === true) {
          return require(name)
        }
        throw new Error(`module ${name} cannot be required. see TODO`)
      },
      module: {
        exports: {}
      },
    }
    return sandbox
  }
}

