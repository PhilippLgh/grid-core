import ora from 'ora'
import chalk from 'chalk'
import { CLIENT_FETCH_STATES } from '../Grid'

export const printFetchStateToCLI = (clientName: string) => {
  let spinner : ora.Ora | undefined = undefined
  const STATES = CLIENT_FETCH_STATES

  // FIXME move logic to fetcher
  let platform = process.platform
  let version = 'latest'

  return (newState: string, args: any) => {
    let taskName = ''
    if (newState === STATES.RESOLVE_VERSION_STARTED) {
      // FIXME const { platform, version} = args
      spinner = ora(`Find specified release: ${clientName} - ${platform}/${version}`).start()
    }
    else if (newState === STATES.RESOLVE_VERSION_FINISHED) {
      const { release } = args
      // FIXME const { platform, version} = args
      if (spinner) {
        // TODO pretty print release vs json
        delete release.original
        const releaseInfo = chalk.gray(JSON.stringify(release, null, 2))
        spinner.succeed(`${`Find specified release: ${clientName} - ${platform}/${version}`}\n${releaseInfo}`)
      }
    }
    /*
    else if (newState === STATES.RELEASE_NOT_FOUND) {
      if (spinner) {
        const { platform, version} = args
        spinner.fail(`Find specified release: ${clientName} - ${platform}/${version}`)
      }
    }
    */
    else if (newState === STATES.DOWNLOAD_STARTED) {
      const { location } = args
      console.log(`Download client binaries from ${chalk.cyan(location)}`)
      spinner = ora('Downloading binaries: 0%').start()
    }
    else if (newState === STATES.DOWNLOAD_PROGRESS) {
      if (spinner) {
        const { progress } = args
        spinner.text = `Downloading binaries: ${chalk.green(`${progress}%`)}`
      }
    }
    else if (newState === STATES.DOWNLOAD_FINISHED) {
      if (spinner) {
        const { verifiedRelease } = args
        const releaseInfo = '' /*boxen(chalk.gray(JSON.stringify(verifiedRelease, null, 2)), {
          padding: 1
        })*/
        spinner.succeed(`Download binaries: 100%`)
      }
    }
    else if (newState === STATES.VERIFICATION_ERROR) {
      const { message } = args
      const recoverySolutionText = `==> fallback to PGP signature verification`
      spinner = ora().start().fail(`Ethpkg verification failed: ${message}\n${recoverySolutionText}`)
    }
    else if (newState === STATES.VERIFICATION_FAILED) {
      spinner = ora().start().fail(chalk.red(`Verification failed!`))
    }
    else if (newState === STATES.PACKAGE_WRITTEN) {
      const { packagePath } = args
      spinner = ora().start().succeed(`Package written to: ${packagePath}`)
    }
    else if (newState === STATES.PACKAGE_EXTRACTION_STARTED) {
      const { location } = args
      spinner = ora('Extracting package: 0%').start()
    }
    else if (newState === STATES.PACKAGE_EXTRACTION_PROGRESS) {
      if (spinner) {
        const { progress, file } = args
        spinner.text = `Extracting package: ${chalk.green(`${progress}% - "${file}"`)}`
      }
    }
    else if (newState === STATES.PACKAGE_EXTRACTION_FINISHED) {
      if (spinner) {
        const { packageContentsPath } = args
        spinner.succeed(`Package extracted: 100% - ${packageContentsPath}`)
      }
    }
    else if (newState === STATES.BINARY_EXTRACTED) {
      const { binaryPath } = args
      spinner = ora().start().succeed(`Binary written to: ${binaryPath}`)
    }
  }
}

export const replaceAll = (str: string, searchVal: string, replaceVal: string ) : string => {
  return str.split(searchVal).join(replaceVal)
}
