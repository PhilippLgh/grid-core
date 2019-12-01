export default interface ISerializable {
  toJson() : Promise<string>
}