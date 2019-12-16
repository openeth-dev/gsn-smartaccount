const BlockchainEvent = require('./BlockchainEvent')

class LevelFrozenEvent extends BlockchainEvent {
  constructor (web3event) {
    super(web3event)
    this.frozenLevel = web3event.args.frozenLevel.toNumber()
    this.frozenUntil = web3event.args.frozenUntil.toNumber()
  }
}

module.exports = LevelFrozenEvent
