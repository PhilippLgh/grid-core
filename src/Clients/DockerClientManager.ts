import fs from 'fs'
import path from 'path'
import stream, { Stream } from 'stream' 

import { ClientManager, FetchClientOptions, ClientManagerConfig, PROCESS_EVENTS } from "./ClientManager"
import Client from "./Client"

import Docker, { Container } from 'dockerode'
import { IPackage, PackageManager} from 'ethpkg'
import DockerClient from './DockerClient'
import { StateListener } from '../StateListener'
import { bufferToStream } from '../StreamUtils'

const STATUS = {
  DOWNLOAD_COMPLETE: 'Download complete',
  VERIFYING_CHECKSUM: 'Verifying Checksum',
  DOWNLOADING: 'Downloading',
  PULLING_FS_LAYER: 'Pulling fs layer',
  PULL_COMPLETE: 'Pull complete',
  EXTRACTING: 'Extracting',
}
const pull = (docker: Docker, repoTag: string) => {
  return new Promise((resolve, reject) => {
    docker.pull(repoTag, function(err: Error, stream: Stream) {
      docker.modem.followProgress(stream, onFinished, onProgress);
      function onFinished(err: Error, output: Array<any>) {
        //output is an array with output json parsed objects
        resolve(output)
      }
      function onProgress(event: any) {
        // downloads are done in parallel with id referencing a specific download
        const { status, progressDetail, id  } = event
        if (status === STATUS.DOWNLOADING && progressDetail) {
          const { current, total } = progressDetail
        }
        // console.log('progress', event)
      }
    })
  })
}

export default class DockerClientManager extends ClientManager {

  docker: Docker
  resources?: IPackage

  constructor(config: ClientManagerConfig, pluginCtx?: IPackage) {
    super(config)
    this.resources = pluginCtx
    const { name, repository, filter, prefix } = config
    const socket = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
    const stats  = fs.statSync(socket);
    if (!stats.isSocket()) {
      throw new Error('Could not establish Docker connection - is Docker running?');
    }
    this.docker = new Docker({ socketPath: socket });
  }

  private isDockerHubImage() {
    return this.repository.includes(':dockerhub/')
  }

  private isRemoteDockerImage() {
    // try to support other registries
    return !this.repository.startsWith('docker:local/')
  }

  private isLocalImage() {
    return this.repository.includes(':local/')
  }

  private getImageName() {
    if(this.isDockerHubImage()) {
      let imageName = this.repository.split('dockerhub/').pop()
      if (!imageName) {
        throw new Error('Could not parse docker image name')
      }
      return imageName
    } 
    else if (this.isRemoteDockerImage()) {
      let imageName = this.repository.split('docker:').pop()
      if (!imageName) {
        throw new Error('Could not parse docker image name')
      }
      return imageName
    }
    else if(this.isLocalImage()) {
      const [prefix,name] = this.repository.split('local/')
      return name.startsWith('grid_') ? name : `grid_${name}`
    } else {
      throw new Error('Unsupported Docker specifier')
    }
  }

  private getContainerName() {
    // only [a-zA-Z0-9][a-zA-Z0-9_.-] are allowed
    // zokrates/zokrates => dockerhub image name would not be allowed
    return this.name.startsWith('grid_') ? this.name : `grid_${this.name}`
  }

  private async getDockerfile() {
    if (!this.resources) {
      return undefined
    }
    const dockerfile = await this.resources.getEntry('Dockerfile')
    return dockerfile
  }

  private async hasDockerFile() {
    return ((await this.getDockerfile()) !== undefined)
  }

  public async createImage(imageName: string, listener: StateListener = (newState: string, arg: any) => undefined) {
    if (!this.resources) {
      throw new Error('Plugin does not have resources to create Docker image. Define a top-level entry named "Dockerfile"')
    }
    const dockerfile = await this.getDockerfile()
    if (!dockerfile) {
      throw new Error('Plugin does not have resources to create Docker image. Define a top-level entry named "Dockerfile"')
    }
    const buf = await this.resources.toBuffer()
    const _stream = await this.docker.buildImage(bufferToStream(buf), {
      t: imageName.startsWith('grid_') ? imageName: `grid_${imageName}` // always prefix
    })

    // parse stream and pass events to listener
    _stream.on('data', (chunk: any) => {
      try {
        let st = chunk.toString('utf8')
        // st = st.replace(/\r*\n*\s*\S*/g, '')
        st = st.replace(/\r?\n|\r/g, '')
        st = st.replace(/}/gi, '},')
        st = st.replace(',}', '}')
        let jsonString = `[${st}]`
        jsonString = jsonString.replace(',]', ']')
        const eventObjects = JSON.parse(jsonString)
        const logs = eventObjects.map((e : any) => e.stream ? e.stream.trim() : '').filter((log : string) => log)
        for (const log of logs) {
          listener(PROCESS_EVENTS.DOCKER_EVENT, { log: log })
        }
      } catch (error) {
        console.log('parse docker log error', error.message)
      }
    })

    const res = await new Promise((resolve, reject) => {
      this.docker.modem.followProgress(_stream, (err: Error, res: any) => err ? reject(err) : resolve(res));
    })

    if (res) {
      return imageName
    }
    return undefined
  }

  private async getContainer(containerName: string, stopRunning = true) : Promise<Container | undefined> {
    const containers = await this.docker.listContainers({all: true});
    const containerInfo : Docker.ContainerInfo | undefined = containers.find(c => c.Names[0] === `/${containerName}`)
    if (!containerInfo) { 
      return undefined
    }
    const { Id, State, /*Names,*/ Image } = containerInfo
    const container = await this.docker.getContainer(Id)
    // handles "container already started"
    if (State !== 'stopped' && stopRunning) {
      try {
        await container.stop()
      } catch (error) {
        // ignore if stopped already
        // console.log('container could not be stopped:', error.message)
      }
    }
    return container
  }

  private async createContainer(imageName: string, containerName: string, overwriteContainer = false) {
    // TODO  handle 'OCI runtime create failed: container_linux.go:346: starting container process caused "exec: \\"/bin/bash\\": stat /bin/bash: no such file or directory": unknown'
    // TODO  handle no such container - No such image: golang:1.13-alpine 
    const stopIfRunning = true
    let container = await this.getContainer(containerName, stopIfRunning)
    if (!container || overwriteContainer) {
      container = await this.docker.createContainer({
        Image: imageName,
        name: containerName,
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        // The -it runs Docker interactively (so you get a pseudo-TTY with STDIN)
        Tty: true, // keeps container running
        OpenStdin: true,

        // EXPOSE 8545 8546 8547 30303 30303/udp
        // FIXME a problem that probably occurs is that ports get configured by the user in between init() and start()
        ExposedPorts: { 
          //'80/tcp:': {},
          '8545/tcp': {},
          //'8546/tcp': {},
          //'8547/tcp': {},
          '30303/tcp': {},
          //'30303/udp:': {},
        },
        HostConfig: {
          PortBindings: {
            "8545/tcp": [{ "HostPort": "8545" }],   //Map container to a random unused port.
            "30303/tcp": [{ "HostPort": "30303" }]   //Map container to a random unused port.
          }
        }
        // Entrypoint is specified in DockerClient when started
        // Entrypoint: ['/bin/bash']
      })
    }
    return container
  }

  async removeContainer(containerId: string) {
    /*
    let container : Container | undefined = undefined
    if (containerInfo) {
      console.log('try stopping container in state:', State)
      console.log('dispose temp container')
      await container.remove({ force: true })
      console.log('container removed')
    }
    */
  }

  /*
    private async wrapBinary() {
    if (!this.binaries) {
      throw new Error('Cannot wrap binaries - binaries are undefined')
    }
    if (!this.container) {
      throw new Error('Cannot wrap binaries - no container available')
    }
    // FIXME make sure binaries are compatible with image (linux platform)
    const metadata = this.binaries.metadata
    console.log('binary metadata', metadata ? metadata.version : 'no metadata')
    const BIN_DEST_PATH = '/usr/local/bin/'


    console.log('copy binary to container')
    // COPY --from=builder /go-ethereum/build/bin/geth /usr/local/bin/
    // FIXME make sure that IPackage is tar and uses correct encoding
    const file : string | Buffer | ReadableStream = await this.binaries.toBuffer()
    await this.container.putArchive(file,{
      path: BIN_DEST_PATH
    })
    console.log('binary copied to ', BIN_DEST_PATH)
  }
  */


  /**
   * if docker hub => pull image
   * if dockerfile => build
   * if available => return local image
   * @param imageName 
   * @param param1 
   */
  async getImage(imageName: string, {
    listener = (state: string, args: any) => {}
  } = {}) {
    if (this.isDockerHubImage()) {
      listener(PROCESS_EVENTS.DOWNLOAD_STARTED, { location: 'DockerHub:'+imageName })
      const image = await pull(this.docker, imageName)
      listener(PROCESS_EVENTS.DOWNLOAD_FINISHED, { location: 'DockerHub:'+imageName })
      return image
    }
    else if (this.isRemoteDockerImage()) {
      listener(PROCESS_EVENTS.DOWNLOAD_STARTED, { location: imageName })
      const image = await pull(this.docker, imageName)
      listener(PROCESS_EVENTS.DOWNLOAD_FINISHED, { location: imageName })
      return image
    } 
    else if(this.isLocalImage()) {
      // don't need to check if image already exists
      // we can just re-create and docker will (should?) be fast due to caching
      if (await this.hasDockerFile()) {
        listener(PROCESS_EVENTS.DOCKERFILE_FOUND, {})
        listener(PROCESS_EVENTS.CREATE_DOCKER_IMAGE_FROM_FILE_STARTED, { name: imageName })
        const imageId = await this.createImage(imageName, listener)
        listener(PROCESS_EVENTS.CREATE_DOCKER_IMAGE_FROM_FILE_FINISHED, { name: imageName })
        return imageId
      } 
      else {
        // TODO this.findImage()
        throw new Error('No dockerfile present in workflow resources - using existing images not yet implemented')
      }
    } else {
      throw new Error(`Invalid repository specifier: "${this.repository}": use "docker:local" or "docker:dockerhub"`)
    }
  }

  /**
   * @overrides
   */
  async getClient({
    // FIXME spec = 'latest', 
    listener = (state: string, args: any) => {}
  } : FetchClientOptions = {}) : Promise<Client> {

    const imageName = this.getImageName()
    const containerName = this.getContainerName()

    const config = this._config
    const metadata = {
      version: undefined // TODO provide client version as metadata
    }

    listener(PROCESS_EVENTS.FIND_EXISTING_DOCKER_CONTAINER_STARTED, { name: imageName })
    let container = await this.getContainer(containerName)
    listener(PROCESS_EVENTS.FIND_EXISTING_DOCKER_CONTAINER_FINISHED, { name: imageName, container })

    if (container) {
      listener(PROCESS_EVENTS.DOCKER_CLIENT_READY, {})
      return new DockerClient(this.docker, container, this._config, metadata)
    }

    // pull or create image - throws if not possible to get image
    let image = await this.getImage(imageName, { listener })
    if (!image) {
      throw new Error('Not possible to pull or create docker image')
    }

    // check kind of docker workflow: wrap vs create (dockerfile) vs reuse
    // TODO else if docker config to create image off base image
    // TODO else if wrap binary -> determine suitable base image
    // TODO if wrapped: tag container based on wrapped binaries

    // FIXME note that fix containerName allows only one container of one client at a time
    listener(PROCESS_EVENTS.CREATE_DOCKER_CONTAINER_STARTED, { image: imageName, name: containerName })
    container = await this.createContainer(imageName, containerName)
    // TODO inspect and validate to see if changes are effective (not so important with dockerfile as with config object)
    // console.log('container prepared!', this.container ? this.container.id : '<unknown>')
    listener(PROCESS_EVENTS.CREATE_DOCKER_CONTAINER_FINISHED, { image: imageName, name: containerName })

    if (!container /*should not happen*/) {
      throw new Error('Failed to start: container could not be created')
    }

    return new DockerClient(this.docker, container, this._config, metadata)
  }
}
