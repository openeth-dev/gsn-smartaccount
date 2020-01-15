const { nonNull } = require('../../../sample/src/js/utils/utils')

const truffleUtils = require('./SafeChannelUtils')

class Participant {
  constructor (address, permissions, level, name) {
    nonNull({ address, permissions, level })
    this.address = address
    this.permissions = parseInt(permissions)
    this.level = parseInt(level)
    this.name = name
    this.permLevel = truffleUtils.packPermissionLevel(permissions, level)
    this.isParticipant = false
  }

  static parse (participantId) {
    const { address, permissions, level } = truffleUtils.decodeParticipant(participantId)
    return new Participant(address, permissions, level)
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

module.exports = Participant
