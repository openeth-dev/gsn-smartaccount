const BlockchainEvent = require('./BlockchainEvent');

class ParticipantRemovedEvent extends BlockchainEvent {

    constructor(web3event) {
        super(web3event);

    }

}

module.exports = ParticipantRemovedEvent;