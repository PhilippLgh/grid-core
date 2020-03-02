import fs from 'fs'
import path from 'path'
import { Command, command, param, params, Options, option, metadata, CastingContext } from 'clime'
import Grid from '../../..'
import { createCLIPrinter } from '../../cli-utils'
import { PROCESS_EVENTS } from '../../../ProcessEvents'

class Flags {
  constructor() {
  }
  static cast(flags: string, context: CastingContext<Flags>): Flags {
    // expects flags: 'client=x,network=y' 
    // note: we do some preprocessing to avoid parsing conflicts with clime
    return flags.split(',').map(f => {
      let [flag, value] = f.split('=')
      return {
        flag, value
      }
    })
  }
}

// FIXME allow flexible pass-through options for plugins 
export class PassThroughOptions extends Options {
  @option({
    flag: 'f',
    description: 'list of --key=value pairs',
    default: '',
  })
  flags?: Flags;
}

@command({
  description: 'runs a workflow',
})
export default class extends Command {
  @metadata
  public async execute(
    @param({
      name: 'workflow',
      description: 'workflow name, url, path or package query',
      required: true,
    })
    workflowSpec: string,
    options: PassThroughOptions
  ) {

    const { flags } = options

    const grid = new Grid()
    const printer = await createCLIPrinter()

    let decorationLength = 50
    await grid.workflowManager.runWorkflow(workflowSpec, flags, {
      listener: (newState: string, args: any) => {
        printer.listener(newState, args)
        if (newState === PROCESS_EVENTS.RUN_WORKFLOW_STARTED) {
          const { workflow } = args
          let descLength = workflow.description.length
          decorationLength = Math.max(Math.min(50, descLength), 100)
          console.log(`Starting workflow:
${'='.repeat(decorationLength)}
Name: ${workflow.name}
Version: ${workflow.version}
Description: ${workflow.description}
${'='.repeat(decorationLength)}
Output:
              `)
        }
      }
    })
    console.log('='.repeat(decorationLength))
  }
}