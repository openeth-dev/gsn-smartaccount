import { nonNull } from '../../../sample/src/js/utils/utils'

const truffleUtils = require('./SafeChannelUtils')

export default class Participant {
  constructor (address, permissions, level, name) {
    nonNull({ address, permissions, level })
    this.address = address
    this.permissions = permissions
    this.level = level
    this.name = name
    this.permLevel = truffleUtils.packPermissionLevel(permissions, level)
    this.isParticipant = false
  }

  expectError (error) {
    const clone = Object.assign({}, this)
    clone.expectError = error
    return clone
  }

  expect () {
    const clone = Object.assign({}, this)
    clone.isParticipant = true
    return clone
  }
}
