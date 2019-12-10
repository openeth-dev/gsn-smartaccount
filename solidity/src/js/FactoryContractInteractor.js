const TruffleContract = require("truffle-contract");
const fs = require('fs');
const Web3 = require('web3');
const zeroAddress = require('ethereumjs-util').zeroAddress

const Utils = require('./Utils');

const VaultCreatedEvent = require('./events/VaultCreatedEvent');
const FreeRecipientSponsorABI = require('./generated/tests/MockGsnForwarder');
const VaultFactoryABI = require('./generated/VaultFactory');
const GatekeeperABI = require('./generated/Gatekeeper');


let VaultFactoryContract = TruffleContract({
    contractName: "VaultFactory",
    abi: VaultFactoryABI
});

let GatekeeperContract = TruffleContract({
    contractName: "Gatekeeper",
    abi: GatekeeperABI
});

let FreeRecipientSponsorContract = TruffleContract({
    contractName: "FreeRecipientSponsorABI",
    abi: FreeRecipientSponsorABI
});

const vaultCreatedEvent = "VaultCreated";


class FactoryContractInteractor {

    constructor(credentials, vaultFactoryAddress) {
        this.credentials = credentials;
        this.vaultFactoryAddress = vaultFactoryAddress;
    }
    /**
     * Not a constructor because constructors cannot be async
     * @param credentials
     * @param vaultFactoryAddress
     * @param ethNodeUrl
     * @param networkId
     */
    static connect(credentials, vaultFactoryAddress, ethNodeUrl, networkId) {

        // Note to self: totally makes sense that this kind of code is only visible on the lowest, pure JS level
        // All the data needed to run this code should be passed as either strings or callbacks to the js-foundation
        let provider = new Web3.providers.HttpProvider(ethNodeUrl);

        VaultFactoryContract.setProvider(provider);
        return new FactoryContractInteractor(credentials, vaultFactoryAddress)
    }

    async attachToContracts(){
        if (this.vaultFactory) {
            return;
        }
        if (!this.vaultFactoryAddress) {
            throw new Error("Vault Factory addresses is not set!");
        }
        this.vaultFactory = await VaultFactoryContract.at(this.vaultFactoryAddress);
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

    static async deployVaultDirectly(from, relayHub, ethNodeUrl) {
        let utilitiesContract = await this.deployUtilitiesLibrary(from, ethNodeUrl)
        let {instance} = await this.deployContract(
          "generated/Gatekeeper",
          "Gatekeeper",
          [utilitiesContract], [zeroAddress(), from], from, ethNodeUrl
        )
        return instance
    }

    /**
     * Migrated this from test code to allow the Factory Interactor to deploy the Factory Contract.
     * This is mainly useful for tests, but anyways, JS-Foundation is the easiest place to put this code.
     * @returns {Promise<String>} - the address of the newly deployed Factory
     */
    static async deployNewVaultFactory(from, ethNodeUrl, forwarder) {
        let utilitiesContract = await this.deployUtilitiesLibrary(from, ethNodeUrl)
        let { instance: vaultFactory } = await this.deployContract("generated/VaultFactory", "VaultFactory", [utilitiesContract], [forwarder], from, ethNodeUrl)
        return vaultFactory;
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

    static async getCreatedVault({factoryAddress, blockNumber, sender, provider}) {
        VaultFactoryContract.setProvider(provider);
        GatekeeperContract.setProvider(provider);
        let vaultFactory = await VaultFactoryContract.at(factoryAddress);
        let options = { fromBlock: blockNumber, toBlock: blockNumber }
        let events = await Utils.getEvents(vaultFactory, vaultCreatedEvent, options, VaultCreatedEvent);
        events = events.filter(event => event.sender.toLowerCase() === sender)
        if (events.length !== 1) {
            throw new Error("Invalid vault created events array size");
        }
        return GatekeeperContract.at(events[0].gatekeeper);
    }


    async deployNewGatekeeper() {
        await this.attachToContracts();
        // TODO: figure out what is wrong with 'estimate gas'.
        //  Works for Truffle test, fails in Mocha test, doesn't give a "out of gas" in console;
        let receipt = await this.vaultFactory.newVault({from: this.credentials.getAddress(), gas: 0x6691b7});
        return new VaultCreatedEvent(receipt.logs[0]);
    }

    async getVaultCreatedEvent(options) {
        await this.attachToContracts();
        let events = await Utils.getEvents(this.vaultFactory, vaultCreatedEvent, options, VaultCreatedEvent);
        if(events.length !== 1){
            throw new Error("Invalid vault created events array size");
        }
        return events[0];
    }
}

module.exports = FactoryContractInteractor;