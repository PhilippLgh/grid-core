import { Command, command, param, Options, option, metadata } from 'clime'
import Grid from '../../..'

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
    workflowName: string
  ) {
    console.log('>> just running a workflow here..')

    const grid = new Grid()

    const workflow = await grid.getWorkflow(workflowName)

    try {
      await workflow.run()
    } catch (error) {
      console.log('workflow error', error)
    }
  }
}