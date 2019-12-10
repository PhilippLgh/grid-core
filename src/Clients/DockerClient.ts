import fs from 'fs'
import path from 'path'
import Docker, { Container } from 'dockerode'
import { Stream } from 'stream'
import { IPackage } from 'ethpkg'
import Client from './Client'
import { streamPromise } from '../StreamUtils'

const spawn = () => {}

export default class DockerClient extends Client {
  container: Docker.Container
  docker: Docker
  constructor(docker: Docker, container: Docker.Container, config: any) {
    super(undefined, config)
    this.docker = docker
    this.container = container
  }

  async start(flags: Array<string> = []) : Promise<string | undefined> {
    if (!this.container) {
      throw new Error('Docker container not initialized')
    }

    // workflow error Error: (HTTP code 500) server error - driver failed programming external connectivity on endpoint grid_test12345 (574bb915ace12b5293da0c8be5f3895b85941d015e915c8d5a02027da6919beb): Bind for 0.0.0.0:30303 failed: port is already allocated 
    // FIXME start with port binding
    // https://stackoverflow.com/questions/20428302/binding-a-port-to-a-host-interface-using-the-rest-api
    await this.container.start()
    const binPath = '/usr/local/bin/geth'
    const Cmd = [binPath, ...flags]
    console.log('start', Cmd)
    /**
    const proc = spawn(this.binaryPath, flags, {
      detached: false // Prepare child to run independently of its parent process.
    })
     */
    // TODO try to re-use ControlledProcess for this
    const exec = await this.container.exec({
      Cmd, 
      AttachStdin: true, 
      AttachStdout: true,
      AttachStderr: true,
      Tty: false
    })
    const stream = await exec.start()

    // this.container.modem.demuxStream(stream, process.stdout, process.stderr);

    // TODO const data = await exec.inspect();

    // FIXME use ControlledProcess for this
    return new Promise((resolve, reject) => {
      stream.once('data',() => {
        resolve()
      })
    })

  }
}
