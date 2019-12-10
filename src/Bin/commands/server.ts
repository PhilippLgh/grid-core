import { Command, command, param, Options, option, metadata } from 'clime'
import Grid from '../../Grid'

@command({
  description: 'starts the grid rpc server and proxy',
})
export default class extends Command {
  @metadata
  public async execute(

  ) {
    const grid = new Grid()
    const host = await grid.startApiServer()

    console.log('server running', host)
  }
}