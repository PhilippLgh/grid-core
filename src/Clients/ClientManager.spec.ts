import fs from 'fs'
import path from 'path'
import { assert } from 'chai'
import { ClientManager } from './ClientManager'

const FIXTURES = path.join(__dirname, '..', '..', 'fixtures')
const BINARIES = path.join(FIXTURES, 'binaries')

const newGethClientManager = () => {
  return new ClientManager({
    name: 'geth',
    repository: 'azure:gethstore',
  })
}

describe('ClientManager', function() {
  describe(``, () => {
    it(`
    ClientManagers are responsible for the lifetime management of multiple Client instances.
    - They are used (internally) to query and find specific binary versions locally or remote
    - Monitor the package download & extraction process
    - Help with dependency resolution e.g. Java - necessary to start a Client
    - They manage all running instances of a specific type of Client 
    - They observe the Client lifecycle, can implement recovery mechanisms for crashing clients or recycle Client instances when they are re-started
    - Can be used to inform other parts of the application about updates and legacy versions
    More: https://github.com/ethereum/grid/issues/520
    `, () => {
      assert.isTrue(true)
    })
  })

  describe('constructor', () => {
    it('accepts a ClientManagerConfig', () => {
      assert.fail('test not implemented')
    })
  })

  describe('async getVersions(options: FetchOptions = {}) : Promise<Array<IRelease>>', function() {
    this.timeout(60 * 1000)
    it('returns a list of IRelease objects including metadata of available hosted(remote) binaries', async () => {
      const cm = newGethClientManager()
      const versions = await cm.getVersions()
      assert.isTrue(versions.length > 0)
    })
    it('returns a list of IRelease objects including metadata of available local binaries', async () => {
      const cm = new ClientManager({
        name: 'geth',
        repository: 'azure:gethstore',
      })
      const versions = await cm.getVersions()
      assert.isTrue(versions.length > 0)
    })
    it('getCachedReleases() compat', () => {
      
    })
    it('getReleases() compat', () => {
      
    })
  })

  describe('async resolve(query: string, listener: StateListener) : Promise<IRelease>', function() {
    it('should ', () => {
      
    })
  })
  
  describe.only('async getClient(): Promise<Array<Client>>', function() {
    this.timeout(60 * 1000)
    it('downloads binaries and creates a Client instance to interact with them', async () => {
      // download a binary first
      const cm = newGethClientManager()
      await cm.getClient({
        // platform: 'mac',
        // version: '',
        cachePath: BINARIES,
        listener: (newState: string) => {
          console.log('new state', newState)
        }
      })
    })
    it('if binaries are already downloaded that match the client query it won\'t download again', () => {
      
    })
    it('getLatest() compat', () => {
      
    })
    it('getLatestCached() compat', () => {
      
    })
    it('getLatestRemote() compat', () => {
      
    })
  })

  describe('async getAllClients() : Promise<Array<Client>>', function() {
    it('should ', () => {
      
    })
  })

})