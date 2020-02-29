import path from 'path'
import fs from 'fs'
import { Command, command, param, Options, option } from 'clime'
import Grid from '../../../Grid'

@command({
  description: 'downloads a client',
})
export default class extends Command {
  public async execute(
    @param({
      name: 'client',
      description: 'client name',
      required: true,
    })
    clientName: string,
    @param({
      name: 'prefix',
      description: 'all files will be written to this directory and subdirectories',
      default: process.cwd()
    })
    prefix: string
  ) {
    // init grid
    const grid = new Grid()
    /*
    // make sure out path exists - create if necessary
    prefix = path.resolve(prefix)
    if (!fs.existsSync(prefix)) {
      fs.mkdirSync(prefix, {
        recursive: true
      })
      cliPrint(`Created directory: ${prefix}`)
    }

    // download package and extract binary to cachePath
    await grid.getClient(clientName, {
      listener: printEventsToCLI(),
      cachePath: prefix
    })
    */
  }
}
