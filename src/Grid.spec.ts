import { assert } from 'chai'
import Grid from './Grid'

describe('Grid Core', function(){


  describe('async createSettings(options: any)', () => {
    
  })

  describe('Plugins', () => {
    describe('async getAllPlugins() : Promise<Array<IPlugin>>', () => {
      it('returns a list of all valid plugins i.e. a configuration object that can be further consumed by business logic components', async () => {
        const grid = new Grid()
        const plugins = await grid.getAllPlugins()
        assert.isTrue(true)
      })
    })
  })
  
  // rather internal API
  describe('Client Managers', () => {

    describe('async createClientManager(config: ClientManagerConfig, pluginCtx?: IPackage) : Promise<ClientManager>', function() {
      this.timeout(60 * 1000)
      it('provides a way to create a client manager on the fly without plugin', async () => {
        const grid = new Grid()
        const clientManager = await grid.createClientManager({
          name: 'my-client',
          repository: 'azure:gethstore'
        })
        const versions = await clientManager.getVersions({
          prefix: 'geth-darwin',
          limit: 10
        })
        assert.lengthOf(versions, 10)
      })
    })
  
    describe('async getAllClientManagers() : Promise<Array<ClientManager>>', () => {
      it('returns a list of all available ClientMangers i.e. plugins that fetch and manage the lifecycle of client binaries', async () => {
        const grid = new Grid()
        const clientManagers = await grid.getAllClientManagers()
        const names = clientManagers.map(c => c.name)
        assert.sameMembers(names, ['geth', 'besu'])
      })
    })
  
    describe('async getClientManager(name : string) : Promise<ClientManager | undefined>', () => {
      it('finds a ClientManager by name', async () => {
        const grid = new Grid()
        const gethManager = await grid.getClientManager('geth')
        assert.isDefined(gethManager)
      })
    })
  })

  describe('Clients', () => {
    describe('async getAllClients() : Promise<Array<Client>>', () => {
      it('returns a list of client instances for every binary/version that is locally managed by all client managers', async () => {
        const grid = new Grid()
        const clients = await grid.getAllClients()
        console.log('clients length', clients.length)
      })
    })
  
    describe('async getClient(clientDefinition: string | ClientManagerConfig, options : FetchClientOptions) : Promise<Client | undefined>', function() {
      this.timeout(60 * 1000)
      it.skip('returns a client instance', async () => {
        const grid = new Grid()
        const client = await grid.getClient('geth')
        // console.log('client version', client?.version)
      })
      it('should ', async () => {
        const grid = new Grid()
        const client = await grid.getClient({
          name: 'geth',
          repository: 'azure:gethstore'
        })
        if(!client) {
          return assert.fail('client not found')
        }
        // console.log('client version', client)
      })
    })
  })

  describe('Workflows', () => {

    describe('async createWorkflow() : Promise<Workflow>', () => {
      it.skip('scaffolds a new workflow package', async () => {
        const grid = new Grid()
        await grid.createWorkflow({
          name: 'test'
        })
      })
    })
    
    describe('async getAllWorkflows() : Promise<Array<Workflow>>', () => {
      it('returns a list of all available workflows', async () => {
        const grid = new Grid()
        const workflows = await grid.getAllWorkflows()
        const names = workflows.map(w => w.name)
        assert.sameMembers(names, ['ewasm', 'mainnet', 'testnet'])
      })
    })
    
    describe('async getWorkflow(workflowName : string) : Promise<Workflow | undefined>', () => {
      it('should ', async () => {
        const grid = new Grid()
        const workflow = await grid.getWorkflow('mainnet')
        assert.isDefined(workflow)
      })
    })

    describe('...', () => {
      
    })
    

  })
  
  describe('API', () => {
    describe('async startApiServer() : Promise<void>', () => {
    
    })
  })

})