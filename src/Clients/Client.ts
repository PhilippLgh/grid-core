import fs from 'fs'
import path from 'path'
import { EventEmitter } from 'events'
import ControlledProcess, { STATES } from '../ControlledProcess'

export { STATES }

export default class Client extends EventEmitter {

  binaryPath: any;
  process?: ControlledProcess;
  config: any;
  packagePath: string | undefined

  constructor(binaryPath: any, config: any, packagePath?: string) {
    super()
    this.binaryPath = binaryPath
    this.config = config
    this.packagePath = packagePath
  }
  get name() {
    return this.config.name
  }
  get displayName() {
    return this.config.displayName
  }
  // we should assume that multiple 
  // instances of one client can be executed at the same time
  get instanceId() {
    return ''
  }
  get version() {
    return ''
  }

  get state() {
    return this.process ? this.process.state : STATES.STOPPED
  }

  private get resolveIpc() {
    return this.config.resolveIpc
  }

  async init() {
    return true
  }

  private registerEventListeners(process: ControlledProcess) {
    // FIXME this needs to be tested for memory leaks with new processes
    // please note that some client might want to subscribe to events
    // BEFORE the process is started so that no events are lost. unsubscribing them here would cause issues
    let eventTypes = [
      'newState',
      'error',
      'log',
      'notification',
      'pluginData',
      'pluginError',
      'setAppBadge',
      'setup-event',
      'clearPluginErrors'
    ]
    eventTypes.forEach(eventName => {
      process.on(eventName, (arg : any) => {
        this.emit(eventName, arg)
        if (eventName == 'pluginError') {
          // this.errors.push(arg)
        }
      })
    })
  }

  private async getStartFlags() {
    /**
    const APP_HOME = path.join(process.cwd(), 'grid_temp', 'besu-1.3.5')
    let DEFAULT_JVM_OPTS='"-Dvertx.disableFileCPResolving=true" "-Dbesu.home=$APP_HOME" "-Dlog4j.shutdownHookEnabled=false" "--add-opens" "java.base/sun.security.provider=ALL-UNNAMED"'
    // let CLASSPATH='$APP_HOME/lib/besu-1.3.5.jar:$APP_HOME/lib/besu-1.3.5.jar:$APP_HOME/lib/jackson-datatype-jdk8-2.9.8.jar:$APP_HOME/lib/besu-clique-1.3.5.jar:$APP_HOME/lib/besu-ibftlegacy-1.3.5.jar:$APP_HOME/lib/besu-ibft-1.3.5.jar:$APP_HOME/lib/besu-consensus-common-1.3.5.jar:$APP_HOME/lib/besu-retesteth-1.3.5.jar:$APP_HOME/lib/besu-ethereum-stratum-1.3.5.jar:$APP_HOME/lib/besu-api-1.3.5.jar:$APP_HOME/lib/besu-blockcreation-1.3.5.jar:$APP_HOME/lib/besu-eth-1.3.5.jar:$APP_HOME/lib/besu-permissioning-1.3.5.jar:$APP_HOME/lib/besu-p2p-1.3.5.jar:$APP_HOME/lib/besu-core-1.3.5.jar:$APP_HOME/lib/besu-config-1.3.5.jar:$APP_HOME/lib/besu-trie-1.3.5.jar:$APP_HOME/lib/besu-crypto-1.3.5.jar:$APP_HOME/lib/enclave-1.3.5.jar:$APP_HOME/lib/besu-ethereum-rlp-1.3.5.jar:$APP_HOME/lib/besu-plugin-rocksdb-1.3.5.jar:$APP_HOME/lib/besu-kvstore-1.3.5.jar:$APP_HOME/lib/besu-pipeline-1.3.5.jar:$APP_HOME/lib/besu-tasks-1.3.5.jar:$APP_HOME/lib/besu-metrics-rocksdb-1.3.5.jar:$APP_HOME/lib/besu-metrics-core-1.3.5.jar:$APP_HOME/lib/besu-nat-1.3.5.jar:$APP_HOME/lib/besu-util-1.3.5.jar:$APP_HOME/lib/plugin-api-1.3.5.jar:$APP_HOME/lib/vertx-web-3.8.0.jar:$APP_HOME/lib/vertx-auth-jwt-3.8.0.jar:$APP_HOME/lib/vertx-unit-3.8.0.jar:$APP_HOME/lib/vertx-web-common-3.8.0.jar:$APP_HOME/lib/vertx-auth-common-3.8.0.jar:$APP_HOME/lib/vertx-jwt-3.8.0.jar:$APP_HOME/lib/vertx-core-3.8.0.jar:$APP_HOME/lib/jackson-databind-2.10.0.jar:$APP_HOME/lib/graphql-java-13.0.jar:$APP_HOME/lib/tuweni-config-0.9.0.jar:$APP_HOME/lib/guava-28.1-jre.jar:$APP_HOME/lib/picocli-3.9.6.jar:$APP_HOME/lib/log4j-slf4j-impl-2.12.1.jar:$APP_HOME/lib/log4j-core-2.12.1.jar:$APP_HOME/lib/log4j-api-2.12.1.jar:$APP_HOME/lib/spring-security-crypto-5.2.0.RELEASE.jar:$APP_HOME/lib/jackson-core-2.10.0.jar:$APP_HOME/lib/bcprov-jdk15on-1.64.jar:$APP_HOME/lib/okhttp-4.2.2.jar:$APP_HOME/lib/tuweni-toml-0.9.0.jar:$APP_HOME/lib/simpleclient_pushgateway-0.7.0.jar:$APP_HOME/lib/simpleclient_common-0.7.0.jar:$APP_HOME/lib/simpleclient_hotspot-0.7.0.jar:$APP_HOME/lib/simpleclient-0.7.0.jar:$APP_HOME/lib/snappy-java-1.1.7.3.jar:$APP_HOME/lib/org.jupnp-2.5.2.jar:$APP_HOME/lib/org.jupnp.support-2.5.2.jar:$APP_HOME/lib/rocksdbjni-6.2.4.jar:$APP_HOME/lib/jackson-annotations-2.10.0.jar:$APP_HOME/lib/antlr4-runtime-4.7.2.jar:$APP_HOME/lib/slf4j-api-1.7.25.jar:$APP_HOME/lib/java-dataloader-2.1.1.jar:$APP_HOME/lib/reactive-streams-1.0.2.jar:$APP_HOME/lib/failureaccess-1.0.1.jar:$APP_HOME/lib/listenablefuture-9999.0-empty-to-avoid-conflict-with-guava.jar:$APP_HOME/lib/jsr305-3.0.2.jar:$APP_HOME/lib/checker-qual-2.8.1.jar:$APP_HOME/lib/error_prone_annotations-2.3.2.jar:$APP_HOME/lib/j2objc-annotations-1.3.jar:$APP_HOME/lib/animal-sniffer-annotations-1.18.jar:$APP_HOME/lib/netty-handler-proxy-4.1.34.Final.jar:$APP_HOME/lib/netty-codec-http2-4.1.34.Final.jar:$APP_HOME/lib/netty-codec-http-4.1.34.Final.jar:$APP_HOME/lib/netty-handler-4.1.34.Final.jar:$APP_HOME/lib/netty-resolver-dns-4.1.34.Final.jar:$APP_HOME/lib/netty-codec-socks-4.1.34.Final.jar:$APP_HOME/lib/netty-codec-dns-4.1.34.Final.jar:$APP_HOME/lib/netty-codec-4.1.34.Final.jar:$APP_HOME/lib/netty-transport-4.1.34.Final.jar:$APP_HOME/lib/netty-buffer-4.1.34.Final.jar:$APP_HOME/lib/netty-resolver-4.1.34.Final.jar:$APP_HOME/lib/netty-common-4.1.34.Final.jar:$APP_HOME/lib/vertx-bridge-common-3.8.0.jar:$APP_HOME/lib/okio-2.2.2.jar:$APP_HOME/lib/kotlin-stdlib-1.3.50.jar:$APP_HOME/lib/kotlin-stdlib-common-1.3.50.jar:$APP_HOME/lib/annotations-13.0.jar'
    let CLASSPATH = '%APP_HOME%/lib/*'
    // const START = '$DEFAULT_JVM_OPTS $JAVA_OPTS $BESU_OPTS -classpath "\"$CLASSPATH\"" org.hyperledger.besu.Besu "$APP_ARGS"'
    let START = '$DEFAULT_JVM_OPTS -classpath "$CLASSPATH" org.hyperledger.besu.Besu'
    
    DEFAULT_JVM_OPTS = replaceAll(DEFAULT_JVM_OPTS, '$APP_HOME', APP_HOME)
    CLASSPATH = replaceAll(CLASSPATH, '$APP_HOME', APP_HOME)
    CLASSPATH = replaceAll(CLASSPATH, '%APP_HOME%', APP_HOME)
    START = replaceAll(START, '$CLASSPATH', CLASSPATH)
    START = replaceAll(START, '$DEFAULT_JVM_OPTS', DEFAULT_JVM_OPTS)
     */
    // FIXME we need better logic for initial flags
    const PACKAGE_PATH = this.packagePath
    let flags = this.name === 'besu' ? [
      '-Dvertx.disableFileCPResolving',
      '-Dbesu.home=$PACKAGE_PATH',
      '-Dlog4j.shutdownHookEnabled=false',
      '--add-opens',
      'java.base/sun.security.provider=ALL-UNNAMED',
      '-classpath',
      '$PACKAGE_PATH/lib/*',
      'org.hyperledger.besu.Besu',
    ] : []
    flags = flags.map(f => {
      return f.replace('$PACKAGE_PATH', PACKAGE_PATH)
    })
    return flags
  }

  /**
   * The promise resolves with a client in *CONNECTED* state
   * @param flags 
   */
  async start(flags : Array<string> = []) : Promise<string | undefined> {
    let startFlags = await this.getStartFlags()
    flags = startFlags.concat(...flags)
    try {
      this.process = new ControlledProcess(
        this.binaryPath,
        this.resolveIpc,
        // this.handleData
      )
      this.registerEventListeners(this.process)
      await this.process.start(flags)
    } catch (error) {
      console.log(`Plugin Start Error: ${error}`)
      throw new Error(`Plugin Start Error: ${error}`)
    }
    return this.process.ipcPath
  }

  async stop() {

  }

  async execute(command: string) : Promise<Array<string>> {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process')
      let flags : Array<string> = []
      if (typeof command === 'string') {
        flags = command.split(' ')
      }
      let proc = undefined
      try {
        proc = spawn(this.binaryPath, flags)
      } catch (error) {
        // console.log('spawn error', error)
        reject(error)
      }
      const { stdout, stderr, stdin } = proc
      proc.on('error', (error: Error) => {
        console.log('process error', error)
      })
      const procData : Array<string> = []
      const onData = (data: any) => {
        const log = data.toString()
        if (log) {
          let parts = log.split(/\r|\n/)
          parts = parts.filter((p : string) => p !== '')
          //this.logs.push(...parts)
          // parts.map((l: string) => this.emit('log', l))
          procData.push(...parts)
        }
      }
      stdout.on('data', onData)
      stderr.on('data', onData)
      proc.on('close', () => {
        resolve(procData)
      })
    })
  }

  async stateChangedTo(newState : string, timeout?: number) {
    if(!this.process) {
      return new Promise((resolve, reject) => {
        // FIXME 
      })
    }
    // TODO does CONNECTED also mean STARTED? -> probably yes
    if (this.process.state === newState) {
      return Promise.resolve(this.process.state)
    } else {
      return new Promise((resolve, reject) => {
        // @ts-ignore
        this.process.once(newState, resolve)
      })
    }
  }

  async rpc(method : string, params = [], id = 0, result = undefined) {
    if (!this.resolveIpc) {
      throw new Error('No IPC RPC API available')
    }
    if (!this.process) {
      throw new Error('RPC API not available - process not running'+ this.state)
      return // FIXME error handling
    }
    let rpcId = 1
    const payload : {[index: string]: any} = {
      jsonrpc: '2.0',
      id: id || rpcId++,
    }
    if (result) {
      payload.result = result
    } else {
      payload.method = method
      payload.params = params
    }
    try {
      const result = await this.process.send(payload)
      return result
    } catch (error) {
      return error
    }
  }

}
