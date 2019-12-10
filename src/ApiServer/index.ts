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
    port: 4743 // 4743 -> grid t9 : might clash with openhpi
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
      const { method, params, id } = payload
      console.log(method, params, id)
      // @ts-ignore
      if (typeof grid[method] === 'function') {
        // @ts-ignore
        const result = await grid[method]()
        /*
        const publicProperties = Object.getOwnPropertyNames(result).filter(name => !name.startsWith('_'))
        const publicMethods = Object.getPrototypeOf(result).filter((name: string) => !name.startsWith('_'))
        const copy = publicProperties.reduce((acc, key) => {
          acc[key] = instance[key];
          return acc;
        }, {})
        */
        return result
      }
    }
  })
  
  try {
    await server.start()
    return server.info.uri
  }
  catch (err) {
    console.log(err)
    process.exit(1)
  }
  
  // console.log('Server running at:', server.info.uri)
}
