import { Command, command, param, Options, option } from 'clime'
import Grid, { CLIENT_FETCH_STATES } from '../../Grid'
import path from 'path'
import { printFetchStateToCLI, replaceAll } from '../cli-utils'
import chalk from 'chalk'

@command({
  description: 'starts a client',
})
export default class extends Command {
  public async execute(
    @param({
      name: 'client',
      description: 'client name',
      required: true,
    })
    clientName: string
  ) {
    const grid = new Grid()
    const client = await grid.getClient(clientName, {
      listener: printFetchStateToCLI(clientName)
    })

    // console.log('start with', START.split(' '))
    client.on('log', (l) => {
      console.log(chalk.gray(l))
    })
    const result = await client.start()
    // const result = await client.execute('version')

  }
}
