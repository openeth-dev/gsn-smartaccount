const GatekeeperABI = require('./generated/Gatekeeper');
const Web3 = require('web3');
const TruffleContract = require("truffle-contract");

// Bullshit wrapper. Passes values to Web3 without much thinking.
class App {

    constructor(ethNodeUrl, contractAddress) {
        this.provider = new Web3.providers.HttpProvider(ethNodeUrl);
        this.web3 = new Web3(this.provider);
        this.gatekeeperContract = TruffleContract({
            abi: GatekeeperABI,
            address: contractAddress
        });
        this.gatekeeperContract.setProvider(this.provider);
    }

    async deployNewGatekeeper(){
        // TODO: clients should not have a bytecode. On-chain factory was actually a good idea.
    }


}

module.exports = App;