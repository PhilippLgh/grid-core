import fs from 'fs'
import path from 'path'
import { Command, command, param, Options, option, metadata } from 'clime'
import Grid from '../../..'
import { createCLIPrinter } from '../../cli-utils'
import chalk from 'chalk'


@command({
  description: 'Publishes a new workflow',
})
export default class extends Command {
  @metadata
  public async execute(
    @param({
      name: 'name',
      description: 'workflow name',
      required: false,
    })
    workflowNameOrPath: string,
    @param({
      name: 'repository',
      description: 'repository used for the upload',
      required: false,
      default: undefined
    })
    repositoryName: string,
    key?: string
  ) {

    const printer = await createCLIPrinter()
    printer.print(`Publish workflow: "${workflowNameOrPath}"`+ (repositoryName ? `to ${repositoryName}` : ''))

    const grid = new Grid()
    try {
      const signingKey = await grid.getSigningKey({
        alias: 'grid',
        password: 'test',
        listener: printer.listener
      })

      const result = await grid.publishWorkflow(workflowNameOrPath, {
        repository: repositoryName,
        listener: printer.listener,
        privateKeyOrSigner: signingKey
      })
      console.log('done:')
      console.log(result.original)

      const { releaseId } = result.original

      const execCommand = `grid-core workflow run ${releaseId}`

      console.log('\n')
      console.log(chalk.cyan('='.repeat(execCommand.length + 5)))
      console.log('✨Congratulations!✨')
      console.log(`You can find your published workflow here:`)
      console.log(chalk.bold('Run the workflow with:'))
      console.log(chalk.cyan('='.repeat(execCommand.length + 5)))
      console.log('\n')
      console.log(chalk.bold(execCommand))
      console.log('\n')
      console.log(chalk.cyan('='.repeat(execCommand.length + 5)))
      console.log('\n')
    } catch (error) {
      return printer.fail(error)
    }
  }
}