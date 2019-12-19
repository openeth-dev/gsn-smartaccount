export default class ConfigEntry {
  constructor ({ type, args, targetModule = null }) {
    this.type = type
    this.args = args
    this.targetModule = targetModule
  }
}
