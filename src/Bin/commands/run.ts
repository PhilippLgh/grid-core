import { Command, command, param, Options, option } from 'clime'
import Grid from '../../Grid'
import path from 'path'
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
    throw new Error('not implemented -  use workflows instead')
  }
}
