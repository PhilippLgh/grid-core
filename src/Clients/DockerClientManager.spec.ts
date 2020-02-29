import fs from 'fs'
import path from 'path'
import { assert } from 'chai'
import DockerClientManager from './DockerClientManager'

const FIXTURES = path.join(__dirname, '..', '..', 'fixtures')
const BINARIES = path.join(FIXTURES, 'binaries')

describe('DockerClientManager', function() {

  describe('constructor', () => {
 
  })
  
  describe.only('async getClient(): Promise<Array<DockerClient>>', function() {
    this.timeout(60 * 1000)

    it('can use DockerHub images', async () => {
      // download a binary first
      const cm = new DockerClientManager({
        name: 'zokrates',
        repository: 'docker:dockerhub/zokrates/zokrates',
      })
      const client = await cm.getClient({
        listener: (newState: string) => {
          console.log('new state', newState)
        }
      })
    })

  })

})