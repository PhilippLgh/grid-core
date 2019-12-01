import readline from 'readline'
import path from 'path'
import fs from 'fs'
import { Command, command, param, Options, option, metadata } from 'clime'
import vm from 'vm'
import Grid from '../../Grid'
import { printFetchStateToCLI } from '../cli-utils'
import chalk from 'chalk'
import { ethers } from 'ethers'


export class ReplOptions extends Options {
  @option({
    flag: 'c',
    description: 'client name',
    default: 'geth'
  })
  client: string = 'geth';
  @option({
    flag: 'm',
    description: 'comma separated list of NPM or ethpk modules to load in context',
    default: ''
  })
  modules: string = '';
}

type StringMap = {[index: string] : any}

@command({
  description: 'Starts a client with attached REPL',
})
export default class extends Command {
  @metadata
  public async execute(
    options: ReplOptions
  ) {

    const { client, modules } = options

    let clientsCtx : StringMap = {}

    /*
    const NODE_MODULES_PATH = path.join(process.cwd(), 'node_modules')
    // TODO add npm specific getLatest logic here - not supported by ethpkg
    const vfs = await installPackageToVirtualFs('npm:ethers@4.0.40', NODE_MODULES_PATH)
    // const vfs = await installPackageToVirtualFs('npm:web3@1.2.4', NODE_MODULES_PATH)
  
    vfs.printPaths()

    // makes resolve find paths in packages
    patchResolve(vfs, [NODE_MODULES_PATH])

    // allows to require file from memory
    patchRequire(vfs)
    */
    
    // this instance will also be available in repl
    const grid = new Grid()

    if (client) {
      console.log('Preparing client:', client)

      const _client = await grid.getClient(client, {
        listener: printFetchStateToCLI(client)
      })

      // FIXME support flags based on workflows
      const geth_flags = ['--dev', '--rpc', '--rpccorsdomain', 'https://remix-alpha.ethereum.org,https://remix.ethereum.org']
      const flags = client === 'besu' ? ['--rpc-http-enabled=true', '--rpc-http-cors-origins="*"'] : geth_flags
      const ipc = await _client.start(flags)
      let provider
      if (ipc) {
        provider = new ethers.providers.IpcProvider(ipc)
      } else {
        console.log(chalk.yellow('WARNING: no ipc - fallback to http rpc api'))
        provider = new ethers.providers.JsonRpcProvider()
      }
      clientsCtx = {
        ethereum: provider
      }
      console.log('')
      console.log(`"ethers" RPC provider is available as ${chalk.blue('ethereum')}`)
      console.log(chalk.blue('Try: > ethereum.getNetwork()'))
      clientsCtx[client] = _client
      console.log('')
      console.log(`Client is available as ${chalk.blue(client)}`)
      console.log(chalk.blue(`Try: > ${client}.rpc('net_version')`))
      console.log('')
    }
    
    // WARNING. the spinners (ora) that are used in printFetchStateToCLI
    // mess with stdin and out  which is why we have to wait
    // before we can init readline
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const _ask = (question: string) : Promise<string> => {
      return new Promise((resolve, reject) => {
        // @ts-ignore
        rl.question(question, function(answer) {
          resolve(answer)
        });
      })
    }

    const context = vm.createContext({
      require,
      setTimeout,
      __dirname,
      // grid,
      exports: {},
      ethers,
      ...clientsCtx
    })
    
    const result = vm.runInContext('const ethers = require("ethers")', context)
    const result2 = vm.runInContext('ethers.version', context)
    console.log('ETHERS VERSION', result2)

    console.log('-------------------------------------------------------')
    console.log('Welcome to Grid REPL v1.0.0.')
    console.log('Grid makes it easy to interact with Ethereum binaries.')
    console.log('Type ".help" for more information.')

    while(true) {
      const answer = await _ask('> ')
      if (answer === '.help') {
        console.log(`.help\t\tPrint this help message`)
        console.log(`.load\t\tLoad an NPM module or package`)
        console.log('Press ^C to abort current expression, ^D to exit the repl')
      }
      if (answer === '.load') {
        console.log('try: load ethers@4.0.39')
      }
      else if (['.break', 'exit', 'stop'].includes(answer)) {
        break
      } else {
        try {
          // wrap to support await
          // const result = await eval(`(async () => { return (${answer})})()`)
          const result = vm.runInContext(answer, context)
          if (result instanceof Promise) {
            let res = await result
            console.log('<Promise> => ',res)
          } else {
            console.log(result)
          }
        } catch (error) {
          console.log('Thrown:')
          console.log(chalk.red('Error:'+error.message))
        }
      }
    }
    rl.close();
 
  }
}
