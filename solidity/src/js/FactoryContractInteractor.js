const TruffleContract = require("truffle-contract");
const fs = require('fs');
const Web3 = require('web3');
const zeroAddress = require('ethereumjs-util').zeroAddress

const Utils = require('./Utils');

const SmartAccountCreatedEvent = require('./events/SmartAccountCreatedEvent');
const FreeRecipientSponsorABI = require('./generated/tests/MockGsnForwarder');
const SmartAccountFactoryABI = require('./generated/SmartAccountFactory');
const SmartAccountABI = require('./generated/SmartAccount');


let SmartAccountFactory = TruffleContract({
    contractName: "SmartAccountFactory",
    abi: SmartAccountFactoryABI
});

let SmartAccountContract = TruffleContract({
    contractName: "SmartAccount",
    abi: SmartAccountABI
});

let FreeRecipientSponsorContract = TruffleContract({
    contractName: "FreeRecipientSponsorABI",
    abi: FreeRecipientSponsorABI
});

const smartAccountCreatedEvent = "SmartAccountCreated";


class FactoryContractInteractor {

    constructor(credentials, smartAccountFactoryAddress) {
        this.credentials = credentials;
        this.smartAccountFactoryAddress = smartAccountFactoryAddress;
    }
    /**
     * Not a constructor because constructors cannot be async
     * @param credentials
     * @param smartAccountFactoryAddress
     * @param ethNodeUrl
     * @param networkId
     */
    static connect(credentials, smartAccountFactoryAddress, ethNodeUrl, networkId) {

        // Note to self: totally makes sense that this kind of code is only visible on the lowest, pure JS level
        // All the data needed to run this code should be passed as either strings or callbacks to the js-foundation
        let provider = new Web3.providers.HttpProvider(ethNodeUrl);

        SmartAccountFactory.setProvider(provider);
        return new FactoryContractInteractor(credentials, smartAccountFactoryAddress)
    }

    async attachToContracts(){
        if (this.smartAccountFactory) {
            return;
        }
        if (!this.smartAccountFactoryAddress) {
            throw new Error("Smart Account Factory addresses is not set!");
        }
        this.smartAccountFactory = await SmartAccountFactory.at(this.smartAccountFactoryAddress);
    }

    static async deployContract(path, name, link, params, from, ethNodeUrl) {
        let abi = require('./' + path);
        let bin = fs.readFileSync(__dirname + "/" + path + ".bin");
        let contract = TruffleContract({
            // NOTE: this string is later passed to a regex constructor when resolving, escape everything
            contractName: name,
            abi: abi,
            binary: bin,
        });
        contract.setProvider(new Web3.providers.HttpProvider(ethNodeUrl));
        link.forEach(function (it) {
            contract.setNetwork(it.network_id);
            contract.link(it);
        })
        let promise
        if (params && params.length > 0) {
            promise = contract.new(...params, { from: from, gas: 1e8 })
        } else {
            promise = contract.new({ from: from, gas: 1e8 })
        }
        let instance = await promise
        contract.address = instance.address
        return { instance, contract }
    }

    static async deployMockHub(from, ethNodeUrl) {
        let {instance} = await this.deployContract(
          "generated/tests/MockHub",
          "MockHub",
          [], [], from, ethNodeUrl
        )
        return instance
    }

    static async deploySponsor(from, relayHub, ethNodeUrl) {
        let {instance} = await this.deployContract(
          "generated/tests/FreeRecipientSponsor",
          "FreeRecipientSponsor",
          [], [], from, ethNodeUrl
        )
        await instance.setRelayHub(relayHub, {from: from})
        return instance
    }

    static async deployNewMockForwarder(from, ethNodeUrl, hub) {
        let {instance} = await this.deployContract(
          "generated/tests/MockGsnForwarder",
          "MockGsnForwarder",
          [], [hub], from, ethNodeUrl
        )
        return instance
    }

    static async deploySmartAccountDirectly(from, relayHub, ethNodeUrl) {
        let utilitiesContract = await this.deployUtilitiesLibrary(from, ethNodeUrl)
        let {instance} = await this.deployContract(
          "generated/SmartAccount",
          "SmartAccount",
          [utilitiesContract], [zeroAddress(), from], from, ethNodeUrl
        )
        return instance
    }

    /**
     * Migrated this from test code to allow the Factory Interactor to deploy the Factory Contract.
     * This is mainly useful for tests, but anyways, JS-Foundation is the easiest place to put this code.
     * @returns {Promise<String>} - the address of the newly deployed Factory
     */
    static async deployNewSmartAccountFactory(from, ethNodeUrl, forwarder) {
        let utilitiesContract = await this.deployUtilitiesLibrary(from, ethNodeUrl)
        let { instance: smartAccountFactory } = await this.deployContract("generated/SmartAccountFactory", "SmartAccountFactory", [utilitiesContract], [forwarder], from, ethNodeUrl)
        return smartAccountFactory;
    }

    //TODO: there is no reason anymore to depend on a library as instance. All methods must be 'inline'
    static async deployUtilitiesLibrary (from, ethNodeUrl) {
        let utilitiesLibraryPlaceholder = '\\$' + Web3.utils.keccak256('Utilities.sol:Utilities').substr(2, 34) + '\\$'
        let { instance, contract: utilitiesContract } = await this.deployContract(
          'generated/Utilities', utilitiesLibraryPlaceholder, [], [], from, ethNodeUrl)
        return utilitiesContract
    }

    static linkEventsTopics(from, to){
        Object.keys(from.events).forEach(function (topic) {
            to.network.events[topic] = from.events[topic];
        });
    }

    static async getGsnForwarder({address, provider}) {
        FreeRecipientSponsorContract.setProvider(provider);
        return FreeRecipientSponsorContract.at(address)
    }

    static async getCreatedSmartAccount({factoryAddress, blockNumber, sender, provider}) {
        SmartAccountFactory.setProvider(provider);
        SmartAccountContract.setProvider(provider);
        let smartAccountFactory = await SmartAccountFactory.at(factoryAddress);
        let options = { fromBlock: blockNumber, toBlock: blockNumber }
        let events = await Utils.getEvents(smartAccountFactory, smartAccountCreatedEvent, options, SmartAccountCreatedEvent);
        events = events.filter(event => event.sender.toLowerCase() === sender)
        if (events.length !== 1) {
            throw new Error("Invalid smart account created events array size");
        }
        return SmartAccountContract.at(events[0].smartAccount);
    }


    async deployNewSmartAccount() {
        await this.attachToContracts();
        // TODO: figure out what is wrong with 'estimate gas'.
        //  Works for Truffle test, fails in Mocha test, doesn't give a "out of gas" in console;
        let receipt = await this.smartAccountFactory.newSmartAccount({from: this.credentials.getAddress(), gas: 0x6691b7});
        return new SmartAccountCreatedEvent(receipt.logs[0]);
    }

    async getSmartAccountCreatedEvent(options) {
        await this.attachToContracts();
        let events = await Utils.getEvents(this.smartAccountFactory, smartAccountCreatedEvent, options, SmartAccountCreatedEvent);
        if(events.length !== 1){
            throw new Error("Invalid smart account created events array size");
        }
        return events[0];
    }
}``

module.exports = FactoryContractInteractor;