import { Command, command, param, Options, option, metadata } from 'clime'
import Grid from '../../..'
import { getDataDir } from '../../../util'

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
    workflowSpecifier: string,
  ) {
    console.log(`install workflow ${workflowSpecifier}`)
    const grid = new Grid()
    let workflow
    try {
      const dataDir = await getDataDir()
      const workflowIdOrUrl = 'TODO'
      console.log('install workflow ', workflowIdOrUrl, 'in', dataDir)    
      const w = grid.getWorkflow(workflowIdOrUrl)
      // workflow = await grid.installWorkflow()

    } catch (error) {
      
    }
  }
}