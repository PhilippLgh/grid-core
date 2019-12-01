import { printFetchStateToCLI } from './Bin/cli-utils'

// warning circular dependency
import Grid, { GLOBAL_SETTINGS, WORKFLOW_TAGS, PLUGIN_TYPES } from './Grid'

const oneOf = (arg: any) => { return arg}
const multiSelect = (arg: any) => { return arg}


export const createContext = (grid: Grid) => {
  // context needs to be a new one for each plugin
  // therefore we use a factory
  return () => {
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
        console.log('require called', name)
        if (name === 'grid-core') {
          return grid
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
        throw new Error(`module ${name} cannot be required. see TODO`)
      },
      module: {
        exports: {}
      },
    }
    return sandbox
  }
}

