const BlockchainEvent = require('./BlockchainEvent');

class OwnerChangedEvent extends BlockchainEvent {

    constructor(web3event) {
        super(web3event);

    }

}


module.exports = OwnerChangedEvent;