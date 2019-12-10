import ora from 'ora'
import chalk from 'chalk'
import { INIT_CLIENT_EVENTS } from '../Grid'

class Printer {
  handlers: any = {}
  context: any = {}
  add(taskName: string, handler: (arg: any) => any) {
    this.handlers[taskName] = handler
    return this
  }
  print(taskName: string, args: any) {
    if (this.handlers[taskName]) {
      const newContext = this.handlers[taskName]({
        ...args,
        ...this.context
      })
      if (newContext) {
        this.context = {
          ...this.context,
          ...newContext
        }
      }
    }
  }
}

export const printFetchStateToCLI = (clientName: string) => {
    
  let spinner : ora.Ora | undefined
  const EVENTS = INIT_CLIENT_EVENTS

  // FIXME move logic to fetcher
  let platform = process.platform
  let version = 'latest'

  const _ = INIT_CLIENT_EVENTS

  const printer = new Printer()
  .add(_.CLIENT_INIT_STARTED, ({ name }) => {
    ora(`Client ${name} initialization started`).start().succeed()
  })
  .add(_.RESOLVE_RELEASE_STARTED, () => {
    // FIXME const { platform, version} = args
    const resolveReleaseTask = ora(`Finding specified release: ${clientName} - ${platform}/${version}`).start()
    return { resolveReleaseTask }
  })
  .add(_.RESOLVE_RELEASE_FINISHED, ({ resolveReleaseTask, release, platform, version }) => {
    // TODO pretty print release vs json
    // FIXME handle release not found with task.fail
    const releaseInfo = chalk.gray(JSON.stringify(release, null, 2))
    resolveReleaseTask.succeed(`Found release for: ${clientName} - ${platform}/${version}\n${releaseInfo}`)
  })
  .add(_.DOWNLOAD_STARTED, ({ location }) => {
    console.log(`Downloading client binaries from ${chalk.cyan(location)}`)
    const downloadTask = ora('Downloading binaries: 0%').start()
    return { downloadTask }
  })
  .add(_.DOWNLOAD_PROGRESS, ({ downloadTask, progress }) => {
    downloadTask.text = `Downloading binaries: ${chalk.green(`${progress}%`)}`
  })
  .add(_.DOWNLOAD_FINISHED, ({ downloadTask, verifiedRelease }) => {
      const releaseInfo = '' /*boxen(chalk.gray(JSON.stringify(verifiedRelease, null, 2)), {
        padding: 1
      })*/
      downloadTask.succeed(`Downloaded binaries: 100%`)
  })
  .add(_.VERIFICATION_ERROR, ({ message }) => {
    const recoverySolutionText = `==> fallback to PGP signature verification`
    const verificationTask = ora().start().fail(`Ethpkg verification failed: ${message}\n${recoverySolutionText}`)
  })
  .add(_.VERIFICATION_FAILED, () => {
    // TODO why?
    ora().start().fail(chalk.red(`Verification failed!`))
  })
  .add(_.PACKAGE_WRITTEN, ({ packagePath }) => {
    ora().start().succeed(`Package written to: ${packagePath}`)
  })
  .add(_.PACKAGE_EXTRACTION_STARTED, ({ location }) => {
    const extractionTask = ora('Extracting package: 0%').start()
    return { extractionTask }
  })
  .add(_.PACKAGE_EXTRACTION_PROGRESS, ({ extractionTask, progress, file }) => {
    extractionTask.text = `Extracting package: ${chalk.green(`${progress}% - "${file}"`)}`
  })
  .add(_.PACKAGE_EXTRACTION_FINISHED, ({ extractionTask, packageContentsPath }) => {
    extractionTask.succeed(`Package extracted: 100% - ${packageContentsPath}`)
    return { extractionTask: undefined }
  })
  .add(_.BINARY_EXTRACTION_STARTED, ({  }) => {
    const binExtractionTask = ora('Extracting binary').start()
    return  { binExtractionTask }
  })
  .add(_.BINARY_EXTRACTION_FINISHED, ({ binExtractionTask, binaryPath  }) => {
    binExtractionTask.succeed(`Binary written to: ${binaryPath}`)
    return  { binExtractionTask: undefined }
  })
  .add(_.CREATE_DOCKER_IMAGE_FROM_FILE_STARTED, () => {
    const dockerfileTask = ora('Creating Docker image from Dockerfile started').start()
    return { dockerfileTask }
  })
  .add(_.CREATE_DOCKER_IMAGE_FROM_FILE_FINISHED, ({ dockerfileTask, dockerfileTaskLogs, name }) => {
    dockerfileTask.succeed(`Created Docker image "${name}" from Dockerfile\n  ${dockerfileTaskLogs.join('\n  ')}`)
    return { dockerfileTask: undefined, dockerfileTaskLogs: undefined } // remove task from context
  })
  .add(_.DOCKER_EVENT, ({ dockerfileTask, dockerfileTaskLogs, log }) => {
    if (dockerfileTask !== undefined) {
      const formattedLog = chalk.grey('DOCKER:'+ log)
      dockerfileTask.text = formattedLog
      dockerfileTaskLogs = dockerfileTaskLogs || []
      dockerfileTaskLogs.push(formattedLog)
      return { dockerfileTaskLogs }
    }
  })
  .add(_.FIND_EXISTING_DOCKER_CONTAINER_STARTED, () => {
    const searchContainerTask = ora('Searching for existing Docker container').start()
    return { searchContainerTask }
  })
  .add(_.FIND_EXISTING_DOCKER_CONTAINER_FINISHED, ({ searchContainerTask }) => {
    // FIXME check if found
    searchContainerTask.succeed('Found existing Docker container')
    return { searchContainerTask: undefined }
  })
  .add(_.CREATE_DOCKER_CONTAINER_STARTED, () => {
    const createContainerTask = ora('Creating Docker container').start()
    return { createContainerTask }
  })
  .add(_.CREATE_DOCKER_CONTAINER_FINISHED, ({ createContainerTask, name }) => {
    createContainerTask.succeed(`Created Docker container "${name}" from Dockerfile`)
    return { createContainerTask: undefined } // remove task from context
  })
  .add(_.DOCKER_CLIENT_READY, () => {
    ora('Docker client ready!').start().succeed()
  })

  return (newState: string, args: any) => {
    printer.print(newState, args)
  }
}

export const replaceAll = (str: string, searchVal: string, replaceVal: string ) : string => {
  return str.split(searchVal).join(replaceVal)
}
