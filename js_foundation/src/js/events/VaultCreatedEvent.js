const BlockchainEvent = require('./BlockchainEvent');

class VaultCreatedEvent extends BlockchainEvent {

    constructor(web3event) {
        super(web3event);
        this.vault = web3event.args.vault;
        this.sender = web3event.args.sender;
        this.gatekeeper = web3event.args.gatekeeper;
    }

}


module.exports = VaultCreatedEvent;