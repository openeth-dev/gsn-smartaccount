class BlockchainEvent {

    constructor(web3event) {
        this.eventName = web3event.event;
        this.blockNumber = web3event.blockNumber;
        this.contractAddress = web3event.address;
        this.transactionHash = web3event.transactionHash;
    }

}



module.exports = BlockchainEvent;