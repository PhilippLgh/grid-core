import { getClientManager } from './Clients/ClientManager'
import { start } from './ApiServer'

export default class Grid {
  static async getClientManager(name : string) {
    return getClientManager(name)
  }
  static async startServer() {
    return start()
  }
}
