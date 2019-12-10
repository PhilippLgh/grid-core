import { Command, command, param, Options, option, metadata } from 'clime'
import Grid from '../../..'

// FIXME allow flexible pass-through options for plugins 
class WorkflowOptions extends Options {
  @option({
    flag: 'n',
    description: 'network name',
    default: 'goerli'
  })
  network: string = 'goerli';
}

@command({
  description: 'runs a workflow',
})
export default class extends Command {
  @metadata
  public async execute(
    @param({
      name: 'workflow',
      description: 'workflow name',
      required: true,
    })
    workflowName: string,
    options: WorkflowOptions
  ) {
    const grid = new Grid()
    const workflow = await grid.getWorkflow(workflowName)
    const config = {}

    try {
      await workflow.run()
    } catch (error) {
      console.log('workflow error', error)
    }
  }
}