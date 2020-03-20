import PluginManager from '../PluginSystem/PluginManager'
import Workflow from './Workflow'
import IRepository from '../IRepository'
import WorkflowRepository from './WorkflowRepository'
import { StateListener } from '../StateListener'
import { throwError, ERROR_WORKFLOW_NOT_FOUND } from '../Errors'
import { WorkflowInfo, WorkflowInfoQuery, JobInfo } from './WorkflowInfo'
import WorkflowRemoteRepository from './WorkflowRemoteRepository'
import ethpkg, { IRelease, IPackage } from 'ethpkg'
import { RegistryConfig } from '../Config'
import { PLUGIN_TYPES } from '../constants'
import { PROCESS_EVENTS } from '../ProcessEvents'
import { Plugin } from '../PluginSystem/Plugin'
import { StringMap } from '../BaseTypes'
import { isDir, uuid } from '../util'
import Job from './Job'

interface IObservableOperation {
  listener?: StateListener // download workflow events
}

export interface AuthorInfo {
  name: string;
  email: string;
}
export interface CreateWorkflowOptions {
  name: string;
  path?: string;
  author?: AuthorInfo;
  license?: string;
  template?: string; // TODO support different templates
}

export interface GetWorkflowOptions extends IObservableOperation {
}

export interface GetWorkflowsOptions extends IObservableOperation {
  stateFilter?: string
}

export interface RunWorkflowOptions extends GetWorkflowOptions {
}

export interface PublishWorkflowOptions extends IObservableOperation {
  repository?: string, // which repo should be used to publish
  privateKeyOrSigner?: Buffer,
}

/**
 * private methods return instances of class Workflow
 * public methods should only return objects of type WorkflowInfo to avoid tight coupling
 * all state should be manager by this class (start, stop of workflows) and the states of managed workflows should be queried
 * if we allow consumers to directly manipulate workflow instances things get messy quite fast
 */
export default class WorkflowManager {

  private _workflows: Array<Workflow> = [] // workflow objects that can be executed
  private _jobs: Array<Job> = [] // stores all executed workflows and their state
  private _installedWorkflows: IRepository<IRelease, IPackage> // repository that manages persisted workflows
  private _hostedWorkflows: WorkflowRemoteRepository // repository that manages hosted workflows
  private _workflowsReady: Promise<boolean>
  private _pluginManager: PluginManager

  private static instance: WorkflowManager;

  public constructor(
    private _installedWorkflowsPath?: string
  ) {
    this._pluginManager = new PluginManager()
    this._installedWorkflows = new WorkflowRepository(_installedWorkflowsPath)
    this._hostedWorkflows = new WorkflowRemoteRepository()
    this._workflowsReady = this._initInstalledWorkflows()
  }

  public static getInstance(installedWorkflowsPath?: string) : WorkflowManager {
    if (!WorkflowManager.instance) {
      WorkflowManager.instance = new WorkflowManager(installedWorkflowsPath);
    }
    return WorkflowManager.instance;
  }

  private _expandSpecifier(workflowSpecifier: string): string {
    if (workflowSpecifier.startsWith('0x')) {
      // expand project id to full ethpkg query
      workflowSpecifier = `${RegistryConfig.NAME}:${RegistryConfig.OWNER_QUERY_FRIENDLY}/${workflowSpecifier}`
    }
    let parts = workflowSpecifier.split('/')
    if (parts.length > 0 && parts[0].endsWith('.eth')) {
      workflowSpecifier = `${RegistryConfig.NAME}:${RegistryConfig.OWNER_QUERY_FRIENDLY}/${workflowSpecifier}`
    }
    return workflowSpecifier
  }

  /**
   * Checks if the package is available as installed package and only tries to downloads
   * a new one if the version is explicitly provided and does not match
   * @param workflowSpecifier 
   */
  private async _getWorkflowPackage(workflowSpecifier: string | IRelease, {
    listener = () => {}
  } : GetWorkflowsOptions = {}): Promise<any> {
    let releaseInfo: IRelease | undefined = undefined
    if (typeof workflowSpecifier === 'string') {
      workflowSpecifier = this._expandSpecifier(workflowSpecifier)
      releaseInfo = await ethpkg.resolve(workflowSpecifier, {
        listener
      })
    } else {
      releaseInfo = workflowSpecifier
    }

    if (!releaseInfo) {
      throw new Error('Workflow not found')
    }

    const isInstalled = await this._installedWorkflows?.has(releaseInfo)
    const workflowPkg = isInstalled ? await this._installedWorkflows?.get(releaseInfo) : await this._hostedWorkflows.get(releaseInfo)

    return {
      workflowPkg,
      isInstalled
    }
  }

  /**
   * Initializes a packaged workflow or workflow directory so that it can be executed
   * @param workflowPathOrPkg 
   */
  private async _initWorkflow(workflowPkg: string | IPackage, isInstalled: boolean): Promise<Workflow> {
    const plugin = await this._pluginManager?.load(workflowPkg) as Plugin
    if (!plugin) {
      throw new Error(`Workflow plugin could not be loaded: ${typeof workflowPkg === 'string' ? workflowPkg : workflowPkg.fileName}`)
    }
    const { pluginExports: config, metadata } = plugin
    if (metadata.grid.type !== PLUGIN_TYPES.WORKFLOW) {
      throw new Error(`Plugin is not a workflow"`)
    }

    const workflow = new Workflow(plugin, isInstalled)
    this._workflows.push(workflow)
    return workflow
  }

  private async _initInstalledWorkflows(): Promise<boolean> {
    // avoid multiple inits
    if (this._workflowsReady) {
      return true
    }
    // await this.installWorkflow('grid.philipplgh.eth/hello-grid')
    const installedWorkflowPackages = await this._installedWorkflows.getAll()
    for (const workflowPackage of installedWorkflowPackages) {
      const workflow = await this._initWorkflow(workflowPackage, true)
    }
    return true
  }

  private async _getWorkflow(workflowSpecifier: string, {
    listener = () => {}
  }: GetWorkflowOptions = {}): Promise<Workflow> {
    if (!this._installedWorkflowsPath) {
      throw new Error('Cannot install workflow in directory: directory is undefined')
    }

    let workflow
    if (await isDir(workflowSpecifier)) {
      workflow = await this._initWorkflow(workflowSpecifier, true)
    } else {
      const { workflowPkg, isInstalled } = await this._getWorkflowPackage(workflowSpecifier, {
        listener
      })
      if (!workflowPkg) {
        throw new Error('Failed to retrieve workflow package')
      }
      workflow = await this._initWorkflow(workflowPkg, isInstalled)
    }

    return workflow
  }

  private async _getWorkflows() {
    await this._workflowsReady
    return this._workflows
  }

  private async _getWorkflowById(workflowId: string): Promise<Workflow | undefined> {
    const workflows = await this._getWorkflows()
    return workflows.find(workflow => workflow.id === workflowId)
  }

  public async createWorkflowProject() {

  }

  public async addWorkflow(workflowSource: string, metadata: StringMap) : Promise<WorkflowInfo> {
    const plugin = await this._pluginManager.loadPlugin(workflowSource, metadata)
    const isInstalled = false
    const workflow = new Workflow(plugin, isInstalled)
    this._workflows.push(workflow)
    return workflow.info()
  }

  /**
   * 
   * @param query 
   */
  public async searchWorkflows(query: string): Promise<Array<WorkflowInfo>> {
    return this._hostedWorkflows.searchWorkflows(query)
  }

  public async installWorkflow(workflowSpecifier: string | IRelease): Promise<WorkflowInfo> {
    console.log('install workflow!')
    const { workflowPkg, isInstalled } = await this._getWorkflowPackage(workflowSpecifier)
    if (!workflowPkg) {
      throw new Error('Failed to retrieve workflow package')
    }
    // ignore if package is already installed
    const wasAdded = await this._installedWorkflows?.add(workflowPkg)
    if (!wasAdded) {
      throw new Error('Could not install workflow')
    }
    const workflow = await this._initWorkflow(workflowPkg, isInstalled)
    return workflow.info()
  }

  /**
   * Returns a list of all workflows that match the query template
   * e.g. with info = { isInstalled: true } will return only workflows where isInstalled is set to true
   */
  public async getWorkflows(query?: WorkflowInfoQuery): Promise<Array<WorkflowInfo>> {
    const workflows = await this._getWorkflows()
    const workflowInfo = [
      ...workflows.map(workflow => workflow.info()), 
      ...this._jobs.map(job => job.info())
    ]
    return workflowInfo.filter((workflowInfo: WorkflowInfo) => {
      if (!query) return true
      let match = true
      for(const key in query) {
        // @ts-ignore
        match = match && (workflowInfo[key] === query[key])
      }
      return match
    })
  }

  public async getInstalledWorkflows(info?: WorkflowInfoQuery) {
    return this.getWorkflows({ 
      isInstalled: true
    })
  }

  /**
   * Downloads (if necessary) and initializes a workflow so that it can be executed
   * @param workflowSpecifier 
   */
  public async getWorkflow(workflowSpecifier: string, options?: GetWorkflowOptions): Promise<WorkflowInfo> {
    const workflow = await this._getWorkflow(workflowSpecifier, options)
    return workflow.info()
  }

  public async getJobs() : Promise<Array<JobInfo>> {
    return [...this._jobs].map(job => job.info())
  }

  /**
   * The workflow execution creates a "job" which is basically metadata about the workflows
   * that is being run
   * @param workflowId 
   * @param flags 
   * @param param2 
   */
  public async runWorkflow(workflowIdOrSpecifier: string, flags: Object = {}, {
    listener = () => { }
  }: RunWorkflowOptions = {}): Promise<any> {
    let workflow = await this._getWorkflowById(workflowIdOrSpecifier)
    if(!workflow) {
      workflow = await this._getWorkflow(workflowIdOrSpecifier, { listener })
    }
    if (!workflow) {
      return throwError(ERROR_WORKFLOW_NOT_FOUND)
    }

    // FIXME invalid config
    listener(PROCESS_EVENTS.RUN_WORKFLOW_STARTED, { workflow, config: {} })

    let result
    try {
      const job = await workflow.run(flags)
      this._jobs.push(job)
      result = await job.whenFinished()
      console.log('result', result)
    } catch (error) {
      // console.log('error in workflow', error)
      throw error
      // TODO handle workflow error
      // workflow.setState(WORKFLOW_STATE.CRASHED)
      // workflow.setError(error)
    }
    listener(PROCESS_EVENTS.RUN_WORKFLOW_FINISHED, { workflow })
    return result
  }

  public async scheduleWorkflow(remote = false) {
    throw new Error('not implemented')
  }

  public async publishWorkflow(workflowPath: string, {
    repository = RegistryConfig.NAME,
    listener = () => { },
    privateKeyOrSigner
  }: PublishWorkflowOptions = {}) {
    // this._hostedWorkflows.publish()
  }

}