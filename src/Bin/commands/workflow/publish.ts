import fs from 'fs'
import path from 'path'
import { Command, command, param, Options, option, metadata } from 'clime'
import Grid from '../../..'
import { createCLIPrinter } from '../../cli-utils'


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
    } catch (error) {
      return printer.fail(error)
    }
  }
}