const BlockchainEvent = require('./BlockchainEvent');

class DelayedOperationCancelledEvent extends BlockchainEvent {

    constructor(web3event) {
        super(web3event);
        this.sender = web3event.args.sender;
        this.hash = web3event.args.hash;
    }

}

module.exports = DelayedOperationCancelledEvent;