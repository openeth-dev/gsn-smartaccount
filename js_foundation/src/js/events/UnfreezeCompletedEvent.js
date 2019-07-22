const BlockchainEvent = require('./BlockchainEvent');

class UnfreezeCompletedEvent extends BlockchainEvent {

    constructor(web3event) {
        super(web3event);
    }

}

module.exports = UnfreezeCompletedEvent;