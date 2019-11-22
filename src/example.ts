import Grid from './Grid'
import { STATES } from './Clients/Client'

const grid = new Grid()

const startApi = async () => {
  console.log('start grid server')
  await grid.startApiServer()
}

const runGeth = async () => {
  /* deprecated:
  // creates a ClientManager instance from a plugin
  const gethManager = await grid.getClientManager('geth')
  // fetches release info, finds latest, downloads and extracts binary if necessary
  const geth = await gethManager.getClient()
  // creates a spawned aka (lifecycle-)ControlledProcess
  await geth.start()
  // awaits the `CONNECTED` state
  await geth.stateChangedTo(STATES.CONNECTED)
  // calls Geth's RPC server
  const result = await geth.rpc('--version')
  console.log(`result of --version: ${result}`)
  */
}

startApi()
// runGeth()
