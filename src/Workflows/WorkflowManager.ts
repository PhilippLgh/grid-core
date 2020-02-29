import fs from 'fs'
import path from 'path'
import ethpkg, { instanceOfPackageQuery, IPackage } from 'ethpkg'
import Workflow from './Workflow'
import { isDirSync } from '../util'
import PluginManager from '../PluginSystem/PluginManager'
import { PLUGIN_TYPES, WORKFLOW_TAGS } from '../constants'
import { StateListener } from '../StateListener'
import { PROCESS_EVENTS } from '../ProcessEvents'
import { RegistryConfig } from '../Config'
import { flattenFlags } from './utils'

const { version: GRID_VERSION } = require('../../package.json')

const WORKFLOW_TEMPLATE = (name: string) => 
`
const { default: Grid, FlagBuilder, WorkflowUtils } = require('grid-core')
const ethers = require('ethers')
const { createLogger, prompt } = WorkflowUtils

const logger = createLogger()
const grid = new Grid({
  logger
})

const run = async (config) => {
  logger.log('>> hello workflow', config)
  const client = await grid.getClient('geth')
  const flags = await FlagBuilder.create(client).default().toProcessFlags()
  const ipc = await grid.startClient(client, flags)
  const clientVersion = await client.rpc('web3_clientVersion')
  logger.log('>> Received client version via RPC:', clientVersion)
  await grid.stopClient(client)
}

// lifecycle method:called before workflow stops
const onStop = async () => {
  // used to clean up
  // await grid.stopClients()
}

module.exports = {
  run,
  onStop
}
`

export interface AuthorInfo {
  name?: string;
  email?: string;
}

export interface CreateWorkflowOptions {
  name: string;
  path?: string;
  author?: AuthorInfo;
  license?: string;
}

export interface GetWorkflowOptions {
}

export type PasswordCallback = () => Promise<string>

export interface PublishWorkflowOptions {
  repository?: string, // which repo should be used to publish
  listener?: StateListener // upload progress events
  privateKeyOrSigner?: Buffer,
}

export default class WorkflowManager {

  pluginManager: PluginManager

  constructor(pluginManager: PluginManager) {
    this.pluginManager = pluginManager
  }
  
  // TODO allow to create workflow from different template
  async createWorkflow(options : CreateWorkflowOptions) : Promise<string> {
    // TODO create .gitignore for keyfile
    const { name, path: projectPath } = options
    // TODO test for illegal chars
    if (!name || !projectPath) {
      throw new Error('Invalid arguments for workflow name or path')
    }
    if (fs.existsSync(projectPath)) {
      throw new Error(`Workflow directory "${projectPath}" exists already!`)
    }
    fs.mkdirSync(projectPath, {
      recursive: true
    })
    const NODE_MODULES = path.join(projectPath, 'node_modules')
    fs.mkdirSync(NODE_MODULES)
    // create a symlink to parent for intellisense
    fs.symlinkSync(path.join(__dirname, '..'), path.join(NODE_MODULES, 'grid-core'))
    // TODO symlink in central grid repo for easy run by name
    const pkgJsonPath = path.join(projectPath, 'package.json')
    const pkgJson = {
      name,
      version: '1.0.0',
      description: 'This is the auto-generated test workflow.',
      repository: '',
      author: options.author || {
        name: 'Foo Bar',
        email: 'foo@bar.com'
      },
      license: options.license || 'MIT',
      grid: {
        version: GRID_VERSION, // developed on which grid version
        type: PLUGIN_TYPES.WORKFLOW, // plugin type
        tags: [...Object.values(WORKFLOW_TAGS)],
      }, 
      scripts: {
        // TODO grid-core
        start: 'grid workflow run . --flags', // flags: parses everything and passes through to workflow
        release: 'grid workflow publish .' // cannot be named publish or clashes with `yarn publish`
      }
    }
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2))
    const indexPath = path.join(projectPath, 'index.js')
    fs.writeFileSync(indexPath, WORKFLOW_TEMPLATE(name))
    return projectPath
  }

  async loadWorkflow(workflowPathOrPkg: string | IPackage) : Promise<Workflow> {
    const plugin = await this.pluginManager.load(workflowPathOrPkg)
    const { pluginExports: config, pkgJson } = plugin
    if (pkgJson.grid.type === PLUGIN_TYPES.WORKFLOW) {
      return new Workflow(plugin)
    }
    throw new Error('Cannot construct workflow from plugin')
  }

  async getAllWorkflows() : Promise<Array<Workflow>> {
    const plugins = await this.pluginManager.getAllPlugins()
    let workflows = []
    for (const plugin of plugins) {
      const { pluginExports: config } = plugin
      if (config.type === PLUGIN_TYPES.WORKFLOW) {
        workflows.push(new Workflow(config))
      }
    }
    return workflows
  }

  async getWorkflow(workflowSpec : string, options?: GetWorkflowOptions) : Promise<Workflow | undefined> {
    // check if url or package query
    if (instanceOfPackageQuery(workflowSpec)) {
      const pkg = await ethpkg.getPackage(workflowSpec)
      if (!pkg) {
        console.log('Could not fetch workflow package')
        return
      }
      return this.loadWorkflow(pkg)
    }

    // check if path
    const workflowPath = path.resolve(process. cwd(), workflowSpec)
    if (isDirSync(workflowPath)) {
      return  await this.loadWorkflow(workflowPath)
    } 

    // try to handle as name
    const workflowName = workflowSpec
    const workflows = await this.getAllWorkflows()
    const workflow = workflows.find(w => w.name === workflowName)
    return workflow
  }

  async runWorkflow(workflow?: Workflow | string, flags: any = {}, {
    listener = () => {}
  } : any = {}) {
    if (typeof workflow === 'string') {
      if (workflow.startsWith('0x')) {
        // expand project id to full ethpkg query
        workflow = `${RegistryConfig.NAME}:${RegistryConfig.OWNER_QUERY_FRIENDLY}/${workflow}`
      }
      workflow = await this.getWorkflow(workflow, {
        listener
      })
    }
    if (!workflow) {
      throw new Error('Workflow not found')
    }
    listener(PROCESS_EVENTS.RUN_WORKFLOW_STARTED, { workflow })
    let config = {}
    try {
      config = flattenFlags(flags, workflow.pluginExports.run.config || {})
    } catch (error) {}
    const result = await workflow.run(config)
    listener(PROCESS_EVENTS.RUN_WORKFLOW_FINISHED, { workflow })
    return result
  }

  async validateWorkflowPackage(workflowPath: string) {}

  async publishWorkflow(workflowPath: string, {
    repository = RegistryConfig.NAME,
    listener = () => {},
    privateKeyOrSigner
  }: PublishWorkflowOptions = {}) {

    if (!privateKeyOrSigner) {
      throw new Error('No private key or signer provided')
    }

    const workflowPathFull = path.resolve(workflowPath)
    if (!isDirSync(workflowPath)) {
      throw new Error('Workflow directory not found: '+workflowPathFull)
    }

    const packageJson = JSON.parse(fs.readFileSync(path.join(workflowPathFull, 'package.json'), 'utf8'))
    const workflowName = packageJson.name
    const packageName = packageJson.name
    const packageVersion = packageJson.version
    const pkgFileName = `${packageName}-${packageVersion}`
    // TODO write grid version in package json and maybe some other metadata
    // TODO check that default author is changed
    // TODO check that description is changed
    // TODO check that not using all tags
    let pkg = await ethpkg.createPackage(workflowPathFull, {
      fileName: pkgFileName,
      listener
    })

    // test pkg
    // TODO listener(PROCESS_EVENTS.PACKAGE_VALIDATION_STARTED)
    const entries = await pkg.getEntries()
    const requiredFiles = entries.filter(e => ['index.js', 'package.json'].includes(path.basename(e.relativePath)))
    if (requiredFiles.length !== 2) {
      throw new Error('Workflow seems to be corrupted - files are missing')
    }

    listener(PROCESS_EVENTS.SIGN_WORKFLOW_PKG_STARTED)
    pkg = await ethpkg.signPackage(pkg, privateKeyOrSigner, {
      listener
    })
    listener(PROCESS_EVENTS.SIGN_WORKFLOW_PKG_FINISHED)

    /*
    const destPath = path.join(workflowPathFull, '..', pkgFileName)
    console.log('Write pkg to', destPath)
    await pkg.writePackage(destPath, {
      overwrite: true
    })
    */

    // NOTE package.json validation is handled by ethpkg

    listener(PROCESS_EVENTS.UPLOAD_STARTED, { name: workflowName, repo: repository })
    const result = await ethpkg.publishPackage(pkg, {
      repository: {
        name: repository,
        owner: RegistryConfig.OWNER,
        project: ``
      },
      listener,
      credentials: {
        privateKey: privateKeyOrSigner
      }
    })
    listener(PROCESS_EVENTS.UPLOAD_FINISHED, { name: workflowName, repo: repository })

    return result
  }

}