const BlockchainEvent = require('./BlockchainEvent');

class GatekeeperInitializedEvent extends BlockchainEvent{
    constructor(web3event){
        super(web3event);
        this.participantsHashes = web3event.args.participants;
    }
}


module.exports = GatekeeperInitializedEvent;