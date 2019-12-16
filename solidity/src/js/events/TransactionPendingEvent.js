const BlockchainEvent = require('./BlockchainEvent')

class TransactionPendingEvent extends BlockchainEvent {
  constructor (web3event) {
    super(web3event)
    this.destination = web3event.args.destination
    this.value = web3event.args.value.toString()
    this.erc20token = web3event.args.erc20token
    this.nonce = web3event.args.nonce.toNumber()
    this.delay = web3event.args.delay.toNumber()
  }
}

module.exports = TransactionPendingEvent
