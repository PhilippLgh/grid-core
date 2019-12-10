import fs from 'fs'
import path from 'path'
import stream, { Stream } from 'stream' 

import { ClientManager, FetchClientOptions, ClientManagerConfig, INIT_CLIENT_EVENTS, StateListener } from "./ClientManager"
import Client from "./Client"

import Docker, { Container } from 'dockerode'
import { IPackage } from 'ethpkg'
import DockerClient from './DockerClient'

const bufferToStream = (buf: Buffer) => {
  const readable = new stream.Readable()
  readable._read = () => {} // _read is required but you can noop it
  readable.push(buf)
  readable.push(null)
  return readable
}

const pull = (docker: Docker, repoTag: string) => {
  return new Promise((resolve, reject) => {
    docker.pull(repoTag, function(err: Error, stream: Stream) {
      //...
      docker.modem.followProgress(stream, onFinished, onProgress);
    
      function onFinished(err: Error, output: Array<any>) {
        //output is an array with output json parsed objects
        //...
        resolve(output)
      }
      function onProgress(event: any) {
        //...
        console.log('progress', event)
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
          listener(INIT_CLIENT_EVENTS.DOCKER_EVENT, { log: log })
        }
      } catch (error) {
        console.log('parse error', error.message)
      }
    })

    await new Promise((resolve, reject) => {
      this.docker.modem.followProgress(_stream, (err: Error, res: any) => err ? reject(err) : resolve(res));
    });
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
        console.log('container could not be stopped:', error.message)
      }
    }

    return container
  }

  private async createContainer(imageName: string, containerName: string, overwriteContainer = false) {

    console.log(`create container ${containerName} from image ${imageName}`)

    // TODO pull image only if necessary (not local)
    // FIXME const image = await pull(docker, imageName);
    // console.log('image ready', image)

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
        Tty: true,
        OpenStdin: true,
        /*
        //Cmd: ['/bin/bash', '-c', 'pwd'],
        StdinOnce: false,
        */
    
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
        // FIXME not yet copied Entrypoint: ['geth']
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
   * @overrides
   */
  async getClient({
    spec = 'latest', 
    listener = (newState: string, arg: any) => undefined
  } : FetchClientOptions = {}) : Promise<Client> {

    // check kind of docker workflow: wrap vs create (dockerfile) vs reuse
    const imageName = `grid_${this.name}`

    if (await this.hasDockerFile()) {
      listener(INIT_CLIENT_EVENTS.DOCKERFILE_FOUND, {})
      // don't need to check if image already exists
      // we can just re-create and docker will (should?) be fast due to caching
      listener(INIT_CLIENT_EVENTS.CREATE_DOCKER_IMAGE_FROM_FILE_STARTED, { name: imageName })
      const imageId = await this.createImage(imageName, listener)
      listener(INIT_CLIENT_EVENTS.CREATE_DOCKER_IMAGE_FROM_FILE_FINISHED, { name: imageName })
    } else {
      console.log('workflow has no dockerfile: skip image creation')
    }
    // TODO else if docker config to create image off base image
    // TODO else if wrap binary -> determine suitable base image
    // TODO if wrapped: tag container based on wrapped binaries

    listener(INIT_CLIENT_EVENTS.FIND_EXISTING_DOCKER_CONTAINER_STARTED, { name: imageName })
    let container = await this.getContainer(imageName)
    // TODO successful?
    listener(INIT_CLIENT_EVENTS.FIND_EXISTING_DOCKER_CONTAINER_FINISHED, { name: imageName })

    if (!container) {
      // FIXME note that this allows only one container of oen client at a time
      const containerName = imageName
      listener(INIT_CLIENT_EVENTS.CREATE_DOCKER_CONTAINER_STARTED, { image: imageName, name: containerName })
      container = await this.createContainer(imageName, containerName)
      listener(INIT_CLIENT_EVENTS.CREATE_DOCKER_CONTAINER_FINISHED, { image: imageName, name: containerName })
    }

    if (!container /*should not happen*/) {
      throw new Error('Failed to start: container could not be created')
    }

    // TODO inspect and validate to see if changes are effective (not so important with dockerfile as with config object)
    // console.log('container prepared!', this.container ? this.container.id : '<unknown>')
    listener(INIT_CLIENT_EVENTS.DOCKER_CLIENT_READY, {})

    return new DockerClient(this.docker, container, this._config)
  }
}
