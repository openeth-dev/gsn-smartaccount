class TransactionReceipt {

    constructor(web3receipt){
        this.blockHash = web3receipt.blockHash;
        this.blockNumber = web3receipt.blockNumber;
        this.gasUsed = web3receipt.gasUsed;
        this.transactionHash = web3receipt.transactionHash;
        // Logs are not returned as part of the block because I cannot know what types of events were emitted;
    }

}

module.exports = TransactionReceipt;