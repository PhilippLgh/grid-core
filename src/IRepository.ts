export default interface IRepository<K, V> {
  has(key: K) : Promise<boolean>
  get(key: K) : Promise<V | undefined>
  getAll() : Promise<Array<V>>
  add(entity?: V) : Promise<boolean>
  delete(key: K) : Promise<boolean>
}