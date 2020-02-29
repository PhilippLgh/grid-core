import fs from 'fs'
import path from 'path'
import { Command, command, param, Options, option, metadata } from 'clime'
import Grid from '../../Grid'
import { prompt } from '../interactive'
import chalk from 'chalk'

@command({
  description: 'Creates a global or workspace specific Grid config file',
})
export default class extends Command {
  @metadata
  public async execute(

  ) {
    const configPath = path.join(process.cwd(), '.grid.config.js')
    console.log(`Creating Grid config at: "${configPath}" ...`)
    if (fs.existsSync(configPath)) {
      return console.log(chalk.red('Config exists already!'))
    }
    try {
      const grid = new Grid()
      const keystore = await prompt(`Path to keystore`, process.cwd())
      const cachepath = await prompt(`Path to cache`, await grid.getCachePath())
      const license = await prompt(`License for workflows`, 'MIT')
      const name = await prompt(`Author name`, '')
      const email = await prompt(`Author email`, '')
      const trusted = await prompt(`Trusted authors`, [])
      const config = {
        keystore,
        cachepath,
        license,
        author: {
          name,
          email
        },
        trusted
      }
      fs.writeFileSync(configPath, `module.exports = ${JSON.stringify(config, null, 2)}`)
    } catch (error) {
      console.log(chalk.red('Config creation failed: '+(error.message ? error.message : 'unknown error')))
    }
  }
}
