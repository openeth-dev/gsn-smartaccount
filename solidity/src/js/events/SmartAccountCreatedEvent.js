const BlockchainEvent = require('./BlockchainEvent');

class SmartAccountCreatedEvent extends BlockchainEvent {

    constructor(web3event) {
        super(web3event);
        this.smartAccount = web3event.args.smartAccount;
        this.sender = web3event.args.sender;
    }

}

module.exports = SmartAccountCreatedEvent;