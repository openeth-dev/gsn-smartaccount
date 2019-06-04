const Contract = require('./generated/Contract');
const Web3 = require('web3');
const TruffleContract = require("truffle-contract");

// Bullshit wrapper. Passes values to Web3 without much thinking.
class App {

	constructor(contractAddress, fromAddress) {
		let ethNodeUrl = 'http://localhost:8545';
		this.fromAddress = fromAddress
		this.web3 = new Web3(new Web3.providers.HttpProvider(ethNodeUrl));
		this.contract = new this.web3.eth.Contract(Contract, contractAddress);
	}

	async emitMessage(message, value){
		return this.contract.methods.emitMessage(message, value).send({from: this.fromAddress});
	}

    // This is the reason this layer exists. Hide all blockchain stuff, give sane response
    async emitMessageWrapped(message, value){
        let res = await this.emitMessage(message, value);
        let event = res.events.ContractEmitted;

        return {
            block: 7,
            message: event.returnValues["0"],
            value: event.returnValues["1"]
        }
    }

    async getData(){
		return this.contract.methods.getData().call();
	}

	// noinspection JSUnusedGlobalSymbols
	// noinspection JSMethodCanBeStatic
	foo(value){
		console.log(value)
	}
}

module.exports = App;