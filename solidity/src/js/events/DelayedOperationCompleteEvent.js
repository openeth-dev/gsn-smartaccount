const BlockchainEvent = require('./BlockchainEvent')

class DelayedOperationCompleteEvent extends BlockchainEvent {
  constructor (web3event) {
    super(web3event)
    this.opsNonce = web3event.args.opsNonce
  }
}

module.exports = DelayedOperationCompleteEvent
