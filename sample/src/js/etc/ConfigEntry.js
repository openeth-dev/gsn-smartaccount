export default class ConfigEntry {
  constructor ({ type, args, targetModule }) {
    this.type = type
    this.args = args
    this.targetModule = targetModule
  }
}