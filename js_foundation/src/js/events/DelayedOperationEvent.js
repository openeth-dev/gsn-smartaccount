const BlockchainEvent = require('./BlockchainEvent');

class DelayedOperationEvent extends BlockchainEvent {

    constructor(web3event) {
        super(web3event);
        this.batchMetadata = web3event.args.batchMetadata;
        this.opsNonce = web3event.args.opsNonce;
        this.operation = web3event.args.operation;
        this.dueTime = web3event.args.dueTime;
    }

}

module.exports = DelayedOperationEvent;