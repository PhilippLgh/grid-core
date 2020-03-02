// warning circular dependency
import Grid, { GridOptions } from './Grid'
import { IPackage } from 'ethpkg'
import * as WorkflowUtils from './Workflows/utils'
import { ethers } from 'ethers'
import { FlagBuilder } from './Clients/Flags'
import { EventEmitter } from 'events'


type PluginMetadata = {
  name: string;
}

/**
 * 
 * Modules are cached after the first time they are loaded. 
 * This means (among other things) that every call to require('foo') will get exactly the same object returned, 
 * if it would resolve to the same file.
 */
function requireUncached(module: string){
  delete require.cache[require.resolve(module)]
  return require(module)
}

export const createContext = (grid: Grid, insecure = false) => {
  // context needs to be a new one for each plugin
  // therefore we use a factory
  return (pluginMetadata: PluginMetadata, pluginResources : IPackage) => {

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

    const emitter = new EventEmitter()
    emitter.on('error', () => {
      console.log('process error')
    })

    const sandbox = {
      // process,
      process: {
        stderr: emitter,
        platform: process.platform,
        env: {
          APPDATA: process.env.APPDATA
        },
        // cwd: () => '/' // make memfs relative paths work: https://github.com/streamich/memfs/blob/master/docs/relative-paths.md
      },
      console, // TODO remove console
      // TODO allow insecure mode where require is available
      require: (name: string) => {
        // console.log('require called', name)
        if (name === 'grid-core') {
          return {
            FlagBuilder,
            WorkflowUtils,
            'default': function (args: GridOptions) {
              /**
               * TODO find solution
               * we have a trade-off here:
               * we keep grid as singleton and it only needs to be initialized once
               * potentially saving many seconds depending on complexity
               * but if multiple workflows are run in parallel
               * they cannot share one logger and state can be corrupted
               */
              if (args && args.logger) {
                grid.setLogger(args.logger)
              }
              return new Proxy(grid, handler)
            }
          }
        }
        if (name === 'ethers') {
          return ethers
        }
        if (name === 'fs') {
          let { fs } = requireUncached('memfs')
          return fs
        }
        if (insecure === true) {
          return require(name)
        }
        // TODO documentation for plugin context
        throw new Error(`module ${name} cannot be required. see TODO`)
      },
      module: {
        exports: {}
      },
    }
    return sandbox
  }
}

