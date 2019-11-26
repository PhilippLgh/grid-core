import { Command, command, param, Options, option } from 'clime'
import Grid from '../../Grid'
import Table from 'cli-table'

@command({
  description: 'lists release info for all packages',
})
export default class extends Command {
  public async execute(
    @param({
      name: 'client',
      description: 'client plugin name',
      required: true,
    })
    clientName: string
  ) {
    const grid = new Grid()
    await grid.whenReady()
    const clientManager = await grid.getClientManager(clientName)
    if (!clientManager) {
      console.log('client manager / plugin not found')
      return
    }
    const releases = await clientManager.getVersions()

    const attributes = 'name,fileName,version,updated_at'

    const attributeList : string[] = attributes.split(',')
    const releaseList = releases.map(release => {
      // only include white-listed attributes in output
      // also respect attribute order
      const output : any[] = []
      for (const att of attributeList) {
        if (att in release) {
          // @ts-ignore
          const val = release[att]
          // cli-table has issues with undefined.toString()
          output.push(val === undefined ? '' : val)
        } else {
          // const { val, path } = recursiveSearch(release, att)
          // output.push(val === undefined ? '' : val)
          output.push('')
        }
      }
      return output
    })
    let table = new Table({
      head: attributeList
    })
    table.push(...releaseList)
    console.log(table.toString())
  }
}
