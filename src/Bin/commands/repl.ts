import readline from 'readline'
import path from 'path'
import fs from 'fs'
import { Command, command, param, Options, option, metadata } from 'clime'
import vm from 'vm'
import Grid from '../../Grid'
import { printFetchStateToCLI } from '../cli-utils'
import chalk from 'chalk'
import { ethers } from 'ethers'
import { sleep } from '../../poc'
import { INIT_CLIENT_EVENTS } from '../../Clients/ClientManager'


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

    let { client, modules } = options

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
      const listener = printFetchStateToCLI(client)
      listener(INIT_CLIENT_EVENTS.CLIENT_INIT_STARTED, { name: client })

      let _client
      if (client === 'ewasm') {
        const workflow = await grid.getWorkflow(client)
        const { getClient } = workflow.exports
        _client = await getClient({
          listener
        })
      } else {
        _client = await grid.getClient(client, {
          listener
        })
      }

      let flags : Array<string> = []
      // FIXME support flags based on workflows
      // const geth_flags = ['--dev', '--rpc', '--rpccorsdomain', 'https://remix-alpha.ethereum.org,https://remix.ethereum.org']
      if (client === 'geth') {
        flags = ['--dev', '--rpc', '--rpcaddr', "0.0.0.0"]
      } 
      else if (client === 'ewasm') {
        flags = [
          '--vm.ewasm="/path/to/libhera.so,metering=true,fallback=true"',
          '--datadir', '/tmp/ewasm-node/4201/',
          '--etherbase', '031159dF845ADe415202e6DA299223cb640B9DB0',
          '--rpc', '--rpcapi', "web3,net,eth,debug",
          '--rpcvhosts="*"', '--rpcaddr', "0.0.0.0",
          '--rpccorsdomain', "*",
          '--vmodule', "miner=12,rpc=12",
          '--mine', '--miner.threads', '1',
          '--nodiscover',
          '--networkid', '66',
          '--bootnodes', "enode://53458e6bf0353f3378e115034cf6c6039b9faed52548da9030b37b4672de4a8fd09f869c48d16f9f10937e7398ae0dbe8b9d271408da7a0cf47f42a09e662827@23.101.78.254:30303"
        ]
      } else if (client === 'besu') {
        flags = ['--rpc-http-enabled=true', '--rpc-http-cors-origins="*"']
      }
      
      const ipc = await _client.start(flags)
      // FIXME determine RPC ready state
      console.log('FIXME wait 5sec for RPC')
      await sleep(3000)

      let provider
      if (ipc) {
        provider = new ethers.providers.IpcProvider(ipc)
      } else {
        console.log(chalk.yellow('WARNING: no ipc - fallback to http rpc api'))
        provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545')
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
