import fs from 'fs'
import path from 'path'
import Docker, { Container } from 'dockerode'
import Client, { ClientStartOptions, ExecuteOptions } from './Client'
import { PackageManager, IFile } from 'ethpkg'
import { streamToBuffer } from '../StreamUtils'
import { streamPromise, isDirPath } from 'ethpkg/dist/util'

export default class DockerClient extends Client {
  container: Docker.Container
  docker: Docker
  entryPoint?: string
  constructor(docker: Docker, container: Docker.Container, config: any, metadata: any) {
    super(undefined, config, metadata)
    this.docker = docker
    this.container = container
  }

  async stop() {
    return this.container.stop()
  }

  async getFile(filePath: string) {
    if (!filePath) {
      throw new Error(`No path provided getFile()`)
    }
    const data = await this.container.inspect()
    const cwd = data.Config.WorkingDir

    const stream = await this.container.getArchive({
      'path': filePath
    })
    // @ts-ignore
    const buf =  await streamToBuffer(stream)
    const pm = new PackageManager()
    const pkg = await pm.getPackage(buf)
    if (!pkg) {
      return undefined
    }
    // if dir return all files
    if (isDirPath(filePath)) {
      return pkg
    }
    return pkg.getContent(filePath)
  }

  async putFile(filePath: string, content: string) {
    if (!filePath) {
      throw new Error(`No path provided putFile()`)
    }
    if (!content) {
      throw new Error(`No content for file: "${filePath}"`)
    }

    const fileName = path.basename(filePath)
    if (!fileName) {
      throw new Error('filePath does not include file name')
    }

    // create archive
    const pm = new PackageManager()
    /**
     https://github.com/apocas/dockerode/issues/535#issuecomment-534304725
     !!!! IMPORTANT !!!!
     "The input stream must be a tar archive compressed with one of the following algorithms: identity (no compression), gzip, bzip2, xz."
    */
    const pkg = await pm.createPackage('data.tar.gz')
    await pkg.addEntry(fileName, content)
    const pkgBuf = await pkg.toBuffer()

    const data = await this.container.inspect()
    // TODO consider the entry point and putting files relative to binary
    const cwd = data.Config.WorkingDir
    // FIXME we might need to call mkdir or pass option if file has nested dir path

    const stream = await this.container.putArchive(pkgBuf, {
      path: cwd
    })

    return path.join(cwd, filePath)
  }


  async start(flags: Array<string> = [], {
    entryPoint = undefined,
    service = false
  }: ClientStartOptions = {}) : Promise<string | undefined> {
    if (!this.container) {
      throw new Error('Docker container not initialized')
    }

    // console.log('start container with options:', entryPoint, service)
    if (entryPoint) {
      this.entryPoint = entryPoint
    } else {
      const data = await this.container.inspect()
      if (data.Config.Entrypoint) {
        this.entryPoint = data.Config.Entrypoint[0]
        // TODO use listener
        console.log('Entrypoint set to: ',this.entryPoint,'based on container config')
      }
    }

    // workflow error Error: (HTTP code 500) server error - driver failed programming external connectivity on endpoint grid_test12345 (574bb915ace12b5293da0c8be5f3895b85941d015e915c8d5a02027da6919beb): Bind for 0.0.0.0:30303 failed: port is already allocated 
    // FIXME start with port binding
    // https://stackoverflow.com/questions/20428302/binding-a-port-to-a-host-interface-using-the-rest-api

    // starting container with non-empty request body was deprecated -> no args for start?
    // TODO attach to docker : see below
    /**
     * TODO ideally we do same as in ControlledProcess
     * const proc = spawn(this.binaryPath, flags)
     * const { stdout, stderr, stdin } = proc
     * where we keep the container running and attach 3 stream objects to it
     * this way we can re-use ControlledProcess and have better control over
     * interactive binaries that request input > write to stdin
     * while keeping an abstraction from the terminal where process is running in - electron, web ui
     * (no process.stdin) which also allows to run multiple workflows in parallel
     */
    const result = await this.container.start()

    // if long running service and known entry => start now
    if (service && this.entryPoint) {
      const data = await this.execute([this.entryPoint, ...flags], {
        useBash: false
      })
    }

    // TODO we would usually return ipc path but this is not yet possible
    return ''
  }

  async execute(command: string | string[], {
    useBash = true,
    useEntrypoint = false
  } : ExecuteOptions = {}) : Promise<Array<string>> {

    if (!command) {
      throw new Error('Parameter command is undefined')
    }

    if (useEntrypoint && !this.entryPoint) {
      throw new Error('Cannot use entrypoint in command because it is not set')
    }

    // treat all commands as bash commands: await container.execute('ls -la') will work
    // versus container wit my-client as entrypoint; await client.execute('--version') // will work on client, not bash
    let cmdArray = typeof command === 'string' ? command.split(' ') : command
    command = typeof command !== 'string' ? command.join(' ') : command

    // bash -c string: If the -c option is present, then commands are read from string.  
    // If there  are  arguments  after  the  string,  they  are assigned to the positional parameters, starting with $0.
    let cmd
    if (useBash) {
      cmd = ['sh', '-c', useEntrypoint ? `${this.entryPoint} ${command}` : command]
    } else {
      cmd = useEntrypoint ? [this.entryPoint, ...cmdArray] : cmdArray
    }

    // create exec payload object
    const exec = await this.container.exec({
      cmd, 
      // attach[Stream] means we want the container output
      AttachStdin: true, 
      AttachStdout: true,
      AttachStderr: true,
      Tty: true
    })

    // send exec object to container and collect response from stream
    // stream can be multiplexed i.e. stderr and stdout are mixed over one transport (http)
    const stream = await exec.start()
    /*
    Tty: false =>
    we can demultiplex and separate stdout and stderr
    const stdout = new WritableMemoryStream('stdout')
    const stderr = new WritableMemoryStream('stderr')
    this.container.modem.demuxStream(stream, stdout, stderr);
    */

    return new Promise((resolve, reject) => {
      const _data : string[] = []
      stream.on('data', (data: any) => {
        // remove all tty non-ascii control chars etc
        let printable = data.toString().replace(/[^ -~\r|\n]+/g, "")
        if(printable.includes('runtime exec failed')) {
          reject(new Error('Command failed:\n'+printable))
        }
        // console.log('data', data.toString())
        _data.push(printable)
      })
      let isResolved = false
      const _resolve = () => {
        let logs = _data.join().split(/\r|\n/).filter(l => !!l)
        if (!isResolved) {
          isResolved = true
          resolve(logs)
        }
      }
      stream.on('end', _resolve)
      // if a service is started we wait either till timeout or condition: ipc established
      if (!useBash) {
        setTimeout(_resolve, 3000)
      }
    })
  }
}
