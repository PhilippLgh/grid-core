import fs from 'fs'
import path from 'path'
import Hapi from '@hapi/hapi'
import { IPackage } from 'ethpkg'
import { PROCESS_EVENTS } from '../ProcessEvents'

// FIXME do port probing so that multiple workflows with apps can run
let port = 4488

const injectedApi = `
  console.log('injecting grid api...')  
  window.Grid = {
    getAllPlugins: () => {
      alert('called')
      return {}
    }
  }
`

export const startAppServer = async (app: IPackage, {
  listener = () => {}
}: any = {}) => {
  // @ts-ignore
  const server = Hapi.server({
    host: 'localhost',
    port: port++
  })

  server.route({
    method: 'GET',
    path: '/{path*}',
    handler: async (request: any, h: any) => {
      const { url } = request
      let { pathname } = url
      // console.log('received request', pathname)
      if (pathname.endsWith('grid-api.js')) {
        return injectedApi
      }
      if (pathname === '/') {
        let indexBuf = await app.getContent('index.html')
        let index = indexBuf.toString()
        let injectLegacyApi = false
        if (injectLegacyApi) {
          let pos = index.indexOf('<head>')
          pos = pos + '<head>'.length // include
          const header = index.slice(0, pos)
          const injected = `<script src="./grid-api.js"></script>`
          const remaining = index.slice(pos)
          index = [header, injected, remaining].join()
          return index
        }
        return index
      } else {
        const mime = server.mime.path(pathname)
        const resource = await app.getContent(pathname)
        return h.response(resource).type(mime.type).code(200)
      }
    }
  })

  listener(PROCESS_EVENTS.APP_SERVER_START_STARTED, { app: app.metadata })
  await server.start()
  listener(PROCESS_EVENTS.APP_SERVER_START_FINISHED, { app: app.metadata, url: server.info.uri })

  return server.info.uri
}
