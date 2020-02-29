import Client from "./Client"

export class Flags {
  config: any = {

  }
  dev(val: boolean) {
    throw new Error('Unsupported flag "dev"')
  }
  getRpcAddress() {
    return this.config['rpcaddr']
  }
  getRpcAddressFull() {
    return `http://${this.getRpcAddress()}:8545`
  }
  rpcAddress(val: string) {
    throw new Error('Unsupported flag "rpcAddress"')
  }
  toProcessFlags() : string[] {
    return []
  }
  default() {
    throw new Error('Default profile not implemented')
  }
  rpc() {
    throw new Error('Rpc profile not implemented')
  }
  testnet() {
    throw new Error('Testnet profile not implemented')
  }
}

class Ewasm extends Flags {
  isDocker: boolean = false
  rpc() {
    this.config['rpcaddr'] = '127.0.0.1'
    return this
  }
  testnet() {
    return this
  }
  docker() {
    this.isDocker = true
    // TODO figure out how to deal with docker
    // the problem with docker is that we have multiple pairs of configurations:
    // for the container and for the mappings
    // e.g. bind rpc internally to 0.0.0.0 but expose to 127.0.0.1
    return this
  }
  toProcessFlags() {
    if (!this.isDocker) {
      throw new Error('The flagbuilder currently supports only "dangerous" docker flags  for ewasm')
    }
    const flags = [
      '--vm.ewasm="/path/to/libhera.so,metering=true,fallback=true"',
      '--datadir', '/tmp/ewasm-node/4201/',
      '--etherbase', '031159dF845ADe415202e6DA299223cb640B9DB0',
      '--rpc', '--rpcapi', "web3,net,eth,debug",
      '--rpcvhosts="*"', 
      '--rpcaddr', "0.0.0.0",
      '--rpccorsdomain', "*",
      '--vmodule', "miner=12,rpc=12",
      '--mine', '--miner.threads', '1',
      '--nodiscover',
      '--networkid', '66',
      '--bootnodes', "enode://53458e6bf0353f3378e115034cf6c6039b9faed52548da9030b37b4672de4a8fd09f869c48d16f9f10937e7398ae0dbe8b9d271408da7a0cf47f42a09e662827@23.101.78.254:30303"
    ]
    return flags
  }
  static supports(name: string, version?: string) : boolean {
    if (name === 'ewasm') {
      return true
    }
    return false
  }
}

class Besu extends Flags {
  toProcessFlags() : string[] {
    const PACKAGE_PATH = ''
    let flags = [
      '-Dvertx.disableFileCPResolving',
      `-Dbesu.home=${PACKAGE_PATH}`,
      '-Dlog4j.shutdownHookEnabled=false',
      '--add-opens',
      'java.base/sun.security.provider=ALL-UNNAMED',
      '-classpath',
      `${PACKAGE_PATH}/lib/*`,
      'org.hyperledger.besu.Besu'
    ]
    return flags
  }
  static supports(name: string, version?: string) : boolean {
    if (name === 'besu') {
      return true
    }
    return false
  }
}

class Geth extends Flags {

  dev(val: boolean) {
    this.config.dev = true
    return this
  }
  rpcAddress(address: string) {
    if (address.startsWith('http')) {
      throw new Error('define rpc address without protocol')
    }
    if (address.includes(':')) {
      throw new Error('define rpc address without port')
    }
    this.config['rpcaddr'] = address
    return this
  }
  default() {
    this.config = {}
    return this
  }
  graphql() {
    this.config.graphql = true
    return this
  }
  toProcessFlags() : string[] {
    let flags: string[] = []
    if (this.config['dev']) {
      flags.push('--dev')
    }
    if (this.config['rpcaddr']) {
      flags.push(
        '--rpc', 
        '--rpcaddr', this.config['rpcaddr'],
        '--rpccorsdomain', 'localhost:*,127.0.0.1:*',
      )
    }
    if (this.config.graphql) {
      flags.push(
        '--graphql',
        '--graphql.corsdomain=http://localhost:*,http://127.0.0.1:*'
      )
    }
    return flags
  }
  static supports(name: string, version?: string) : boolean {
    // console.log('supports..', name, version)
    return false
  }
}

class Geth_1_8_Flags extends Geth {}

class Geth_1_9_Flags extends Geth_1_8_Flags {
  static supports(name: string, version?: string) : boolean {
    if (name === 'geth' && version && version.startsWith('1.9.')) {
      return true
    }
    return false
  }
}

const flagSpecs = [Ewasm, Besu, Geth_1_8_Flags, Geth_1_9_Flags]

export class FlagBuilder {
  static create(client: Client) : Flags {
    for (const spec of flagSpecs) {
      if (spec.supports(client.name, client.version)) {
        return new spec()
      }
    }
    throw new Error('Client/Version is not supported by FlagBuilder. Define flags as string[] or contribute: "https://github.com/PhilippLgh/grid-core/issues/5"')
  }
}



