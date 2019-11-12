const BlockchainEvent = require('./BlockchainEvent');

class ParticipantAddedEvent extends BlockchainEvent {

    constructor(web3event) {
        super(web3event);

    }

}


module.exports = ParticipantAddedEvent;