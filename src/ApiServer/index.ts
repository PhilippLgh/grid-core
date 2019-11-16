'use strict'
import Hapi from 'Hapi'
import Grid from '../Grid'

// Start the server  
export async function start(grid: Grid) {

  console.log('start api called')

  // Create a server with a host and port  
  // @ts-ignore
  const server = Hapi.server({
    host: 'localhost',
    port: 8081
  })

  server.route({
    method: 'POST',
    path: '/rpc',
    config: {
      cors: {
        origin: ['*'],
        additionalHeaders: ['cache-control', 'x-requested-with']
      }
    },
    handler: async (request: any, h: any) => {
      const { payload, headers, info, query } = request
      // console.log('params', payload, info, query)
      const clientManagers = await grid.getAllClientManagers()
      return clientManagers
    }
  })

  // Add the route  
  server.route({
    method: 'GET',
    path: '/geth/start',
    handler: async (request: any, h: any) => {
      // this will try to create a client manager from a plugin
      // plugin might need to be fetched
      const clientManager = await grid.getClientManager('geth')
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
  
  try {
    await server.start()
  }
  catch (err) {
    console.log(err)
    process.exit(1)
  }
  
  // console.log('Server running at:', server.info.uri)
}
