import path from 'path'
import { Command, command, param, Options, option, metadata } from 'clime'
import { prompt } from 'enquirer'
import Grid from '../../..'
import chalk = require('chalk')

@command({
  description: 'Creates a new workflow',
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
  ) {
    const grid = new Grid()
    if (!workflowNameOrPath) {
      const response = await prompt({
        type: 'input',
        name: 'name',
        message:'What is the name for your workflow?'
      })
      const { name } = (<any>response)
      workflowNameOrPath = name
    }
    console.log(`Creating new workflow: "${workflowNameOrPath}" ...`)
    const workflowPath = path.resolve(process.cwd(), workflowNameOrPath)
    const workflowName = path.basename(workflowPath)
    const relPath = path.relative(process.cwd(), workflowPath)

    try {
      await grid.createWorkflow({
        name: workflowName,
        path: relPath
      })
    } catch (error) {
      console.log(chalk.red(`Error during workflow creation:\n\t${error.message}`))
      return
    }

    console.log(`Success! Created "${workflowName}" at ${workflowPath}`)
    console.log(`Inside that directory, you can run several commands:\n`)

    console.log(`\t${chalk.cyan('yarn start')}`)
    console.log(`\t\tExecutes the workflow \n`)

    console.log(`\t${chalk.cyan('yarn release')}`)
    console.log(`\t\tPublishes the workflow so that you can share it\n`)

    console.log('We suggest that you begin by typing:\n')
    console.log(`${chalk.cyan('cd')} ${relPath}`)
    console.log(`${chalk.cyan('yarn start')}\n`)

    console.log('Decentralize everything! 🚀\t🌛\n')
  }
}