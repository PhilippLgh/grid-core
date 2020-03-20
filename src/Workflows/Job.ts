import Workflow from "./Workflow"
import { uuid } from "../util"
import { JobInfo, WorkflowInfo } from "./WorkflowInfo"
import { JOB_STATE } from "./JobStates"
import WorkflowError from "./WorkflowError"
import { createPluginContext } from "../GridWorkflowApi"
import { Plugin } from "../PluginSystem/Plugin"
import { flattenFlags } from "./utils"

export default class Job {
  private _jobId: string
  private runPromise?: Promise<any>
  private _state: string
  private finished_at: number | undefined = undefined
  private started_at: number | undefined = undefined
  constructor(
    private readonly _plugin: Plugin,
    private readonly _workflowInfo: WorkflowInfo
  ) {
    this._jobId = `jobId:${uuid()}`
    this._state = JOB_STATE.INITIALIZED
  }
  get id() {
    return this._jobId
  }
  info() {
    const workflowInfo = this._workflowInfo
    const jobInfo : JobInfo = {
      ...workflowInfo,
      id: this._jobId,
      state: this._state,
      started_at: this.started_at,
      finished_at: this.finished_at
    }
    return jobInfo
  }
  private async exitJob(pluginExports: any, error?: Error) {
    if (pluginExports.onStop) {
      try {
        await pluginExports.onStop()
      } catch (error) {
        // TODO log problems in stop
      }
    }
    if (error) {
      // wrap error
      throw new WorkflowError(error, this._plugin.source)
    }
  }
  async whenFinished() {
    return this.runPromise
  }
  async run(flags?: any) {
    console.log('job.run called', this._jobId)
    if (this._state === JOB_STATE.RUNNING) {
      throw new Error('Job already running')
    }
    this._state = JOB_STATE.RUNNING
    // TODO if this is running throw
    /**
     * this is an important step:
     * before the plugin is executed we evaluate the contents
     * of the index.js in a new sandboxed context -> effectively creating
     * a copy of the workflow code with its own runtime environment
     * this way multiple "instances" of one workflow can run
     */
    const sandbox = createPluginContext(this.id)
    const pluginExports = await this._plugin.init(sandbox)

    const run = typeof pluginExports.run.fn === 'function' ? pluginExports.run.fn : pluginExports.run 
    if (!run) {
      throw new Error('Workflow plugin does not specify or export run method')
    }

    let config = {}
    try {
      config = flattenFlags(flags, pluginExports.run.config || {})
    } catch (error) { }

    this.started_at = Date.now()
    this.runPromise = run(config)
    .then((result: any) => {
      this.finished_at = Date.now()
      return result
    })
    .catch((error: Error) => {
      return this.exitJob(pluginExports, error)
    })
    
    return this.runPromise
  }
}
