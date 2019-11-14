'use strict'
import Grid from '../Grid'
const Hapi = require('hapi')

// Create a server with a host and port  
const server = Hapi.server({
  host: 'localhost',
  port: 8081
})

// Add the route  
server.route({
  method: 'GET',
  path: '/geth/start',
  handler: async (request: any, h: any) => {
    // this will try to create a client manager from a plugin
    // plugin might need to be fetched
    const clientManager = await Grid.getClientManager('geth')
    // this will find latest geth release on azure
    // download package
    // check plugin to find binary in package
    // extract binary from package and write to disk
    const geth = await clientManager.getClient()
    if (!geth) return 'not found'
    // this will spawn a new geth process with a plugin-defined
    // default config
    const clientId = await geth.start()
    // return a unique clientId for further communication
    return 'whatever' // TODO clientID
  }
})

// Start the server  
export async function start () {

  try {
    await server.start()
  }
  catch (err) {
    console.log(err)
    process.exit(1)
  }

  console.log('Server running at:', server.info.uri)
}
