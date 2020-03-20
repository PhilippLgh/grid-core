const { version: GRID_VERSION } = require('../../package.json')
import { PLUGIN_TYPES, WORKFLOW_TAGS } from '../constants'

export const WORKFLOW_TEMPLATE = (name: string) => 
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

export const PACKAGE_JSON_TEMPLATE = {
  name: '<unknown>',
  version: '1.0.0',
  description: 'This is the auto-generated test workflow.',
  repository: '',
  author: {
    name: 'Foo Bar',
    email: 'foo@bar.com'
  },
  license: 'MIT',
  grid: {
    version: GRID_VERSION, // developed on which grid version
    type: PLUGIN_TYPES.WORKFLOW, // plugin type
    tags: [...Object.values(WORKFLOW_TAGS)],
  }, 
  scripts: {
    // TODO grid-core
    start: 'grid-core workflow run . --flags', // flags: parses everything and passes through to workflow
    release: 'grid-core workflow publish .' // cannot be named publish or clashes with `yarn publish`
  }
}