const BlockchainEvent = require('./BlockchainEvent');

class TransactionCompletedEvent extends BlockchainEvent {

    constructor(web3event) {
        super(web3event);
        this.destination = web3event.args.destination;
        this.value = web3event.args.value.toString();
        this.erc20token = web3event.args.erc20token;
        this.nonce = web3event.args.nonce.toNumber();
    }
}

module.exports = TransactionCompletedEvent;