import ora from 'ora'
import chalk from 'chalk'
import { PROCESS_EVENTS } from '../Grid'
import { IPackage } from 'ethpkg'

class Printer {
  handlers: any = {}
  context: any = {}
  add(taskName: string, handler: (arg: any) => any) {
    this.handlers[taskName] = handler
    return this
  }
  cancelTasks() {
    const keys = Object.keys(this.context)
    for (const key of keys) {
      const val = this.context[key]
      if (val && typeof val.fail === 'function' && val.isSpinning) {
        val.fail()
      }
    }
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

export const cliPrint = (str: string) => {
  ora(str).start().succeed()
}

const createPrinter = () => {
  const _ =  PROCESS_EVENTS

  const printer = new Printer()
  .add(_.CLIENT_INIT_STARTED, ({ name }) => {
    ora(`Client ${name} initialization started`).start().succeed()
  })
  .add(_.CLIENT_START_STARTED, ({ name, flags }) => {
    const clientStartTask = ora(`Starting client ${name} with flags: ${JSON.stringify(flags)}`).start()
    return { clientStartTask }
  })
  .add(_.CLIENT_START_FINISHED, ({ clientStartTask }) => {
    clientStartTask.succeed()
    return { clientStartTask: undefined }
  })
  .add(_.RESOLVE_RELEASE_STARTED, ({platform, version, name}) => {
    const resolveReleaseTask = ora(`Finding specified release: ${name} - ${platform}/${version}`).start()
    return { resolveReleaseTask }
  })
  .add(_.RESOLVE_RELEASE_FINISHED, ({ resolveReleaseTask, release, platform, version, name }) => {
    // TODO pretty print release vs json
    // FIXME handle release not found with task.fail
    const releaseInfo = chalk.gray(JSON.stringify(release, null, 2))
    resolveReleaseTask.succeed(`Found release for: ${name} - ${platform}/${version}\n${releaseInfo}`)
  })
  .add(_.DOWNLOAD_STARTED, ({ location }) => {
    cliPrint(`Downloading client binaries from: ${chalk.cyan(location)}`)
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
  .add(_.BINARY_EXTRACTION_STARTED, ({ packagePath }) => {
    const binExtractionTask = ora('Extracting binary from package '+(packagePath || '')).start()
    return  { binExtractionTask }
  })
  .add(_.BINARY_EXTRACTION_PROGRESS, ({ binExtractionTask, binaryPathPackage }) => {
    binExtractionTask.text = `Extracting binary "${binaryPathPackage}" from package`
    return  { binExtractionTask }
  })
  .add(_.BINARY_EXTRACTION_FINISHED, ({ binExtractionTask, binaryPathPackage, binaryPathFs  }) => {
    binExtractionTask.succeed(`Binary "${binaryPathPackage}" written to: ${binaryPathFs}`)
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
  .add(_.FIND_EXISTING_DOCKER_CONTAINER_FINISHED, ({ searchContainerTask, name: imageName, container }) => {
    if (container) {
      searchContainerTask.succeed('Found existing Docker container')
    } else {
      searchContainerTask.fail(`No existing container found for "${imageName}"`)
    }
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

  .add(_.CREATE_PACKAGE_STARTED, () => {
    const createPackageTask = ora('Creating workflow package').start()
    return { createPackageTask }
  })
  .add(_.CREATE_PACKAGE_PROGRESS, ({ createPackageTask, file }) => {
    createPackageTask.text = `Packing file: ${chalk.green(`${file}%`)}`
  })
  .add(_.CREATE_PACKAGE_FINISHED, ({ createPackageTask, name: packageName, pkg }) => {
    createPackageTask.succeed(`Created workflow package ${ packageName }`)
    prettyPrintPackage(pkg)    
    return { createPackageTask: undefined }
  })

  .add(_.CREATE_SIGNING_KEY_STARTED, ({ alias }) => {
    // don't use task here since user input might be requested
    cliPrint('Creating signing key: '+alias)
  })
  .add(_.CREATE_SIGNING_KEY_FINISHED, ({ keyPath }) => {
    cliPrint(`Signing key written to: ${ chalk.bold(keyPath) }`)
  })

  .add(_.UNLOCKING_KEY_STARTED, () => {
    const unlockKeyTask = ora('Unlocking signing key').start()
    return { unlockKeyTask }
  })
  .add(_.UNLOCKING_KEY_FINISHED, ({ unlockKeyTask, address }) => {
    unlockKeyTask.succeed(`Unlocked signing key ${address}`)
  })

  .add(_.SIGN_WORKFLOW_PKG_STARTED, () => {
    const signPkgTask = ora('Signing workflow package').start()
    return { signPkgTask }
  })
  .add(_.SIGN_WORKFLOW_PKG_FINISHED, ({ signPkgTask }) => {
    signPkgTask.succeed('Workflow package signed')
  })

  .add(_.REPOSITORY_LOGIN_STARTED, () => {
    const loginTask = ora('Authenticating with repository').start()
    return { loginTask }
  })
  .add(_.REPOSITORY_LOGIN_FINISHED, ({ loginTask, isLoggedIn }) => {
    loginTask.succeed('Authentication finished. Logged in? '+isLoggedIn)
  })

  .add(_.UPLOAD_STARTED, ({ name: workflowName, repo }) => {
    cliPrint(`Uploading workflow "${workflowName}" to: ${chalk.cyan(repo)}`)
    const uploadTask = ora('Uploading workflow: 0%').start()
    return { uploadTask }
  })
  .add(_.UPLOAD_PROGRESS, ({ uploadTask, progress }) => {
    uploadTask.text = `Uploading workflow: ${chalk.green(`${progress}%`)}`
  })
  .add(_.UPLOAD_FINISHED, ({ uploadTask, name: workflowName }) => {
      const releaseInfo = '' /*boxen(chalk.gray(JSON.stringify(verifiedRelease, null, 2)), {
        padding: 1
      })*/
      uploadTask.succeed(`Uploaded workflow "${workflowName}": 100%`)
  })

  .add(_.APP_SERVER_START_STARTED, ({ app }) => {
    const startServerTask = ora(`Starting app server for "${app ? app.fileName : '<unknown app>'}"`).start()
    return {
      startServerTask
    }
  })
  .add(_.APP_SERVER_START_FINISHED, ({ startServerTask, app, url: appUrl }) => {
    startServerTask.succeed(`App server for "${app ? app.name : '<unknown app>'}" running on: ${appUrl}`)
    return {
      startServerTask: undefined
    }
  })

  return printer
}

export const prettyPrintPackage = async (pkg : IPackage) => {
  const entries = await pkg.getEntries()

}

export const replaceAll = (str: string, searchVal: string, replaceVal: string ) : string => {
  return str.split(searchVal).join(replaceVal)
}

export const createCLIPrinter = () => {
  const printer = createPrinter()
  const listener = (newState: string, args: any) => {
    // console.log('new state', newState, args)
    printer.print(newState, args)
  }
  return {
    listener,
    print(message?: any, ...optionalParams: any[]) {
      console.log(chalk.grey('Info: '+message), ...optionalParams)
    },
    fail(err: string | Error){
      // TODO cancel all failed tasks
      printer.cancelTasks()
      const msg = typeof err === 'string' ? err : (err.message ? err.message : 'Unknown Error')
      console.log(chalk.redBright(`Èrror: ${msg}`))
    }
  }
}
