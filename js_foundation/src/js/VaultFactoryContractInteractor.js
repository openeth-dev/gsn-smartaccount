const TruffleContract = require("truffle-contract");
const fs = require('fs');
const Web3 = require('web3');

const Utils = require('./Utils');

const VaultFactoryABI = require('./generated/VaultFactory');

const VaultCreatedEvent = require('./events/VaultCreatedEvent');



const vaultCreatedEvent = "VaultCreated";


class VaultFactoryContractInteractor {

    /**
     * Not a constructor because constructors cannot be async
     * @param credentials
     * @param vaultFactoryAddress
     * @param ethNodeUrl
     * @param networkId
     */
    static async connect(credentials, vaultFactoryAddress, ethNodeUrl, networkId) {

        // Note to self: totally makes sense that this kind of code is only visible on the lowest, pure JS level
        // All the data needed to run this code should be passed as either strings or callbacks to the js-foundation
        let provider = new Web3.providers.HttpProvider(ethNodeUrl);
        let vaultFactoryContract = TruffleContract({
            contractName: "VaultFactory",
            abi: VaultFactoryABI
        });
        vaultFactoryContract.setProvider(provider);
        let vaultFactory = await vaultFactoryContract.at(vaultFactoryAddress);
        return new VaultFactoryContractInteractor(credentials, vaultFactory)
    }

    /**
     * Migrated this from test code to allow the Factory Interactor to deploy the Factory Contract.
     * This is mainly useful for tests, but anyways, JS-Foundation is the easiest place to put this code.
     * @param from
     * @param ethNodeUrl
     * @returns {Promise<string>} - the address of the newly deployed Factory
     */
    static async deployNewVaultFactory(from, ethNodeUrl){

        let utilitiesABI = require('./generated/Utilities');
        let utilitiesBin = fs.readFileSync(__dirname + "/generated/Utilities.bin");
        let utilitiesContract = TruffleContract({
            // TODO: calculate this value
            // NOTE: this string is later passed to a regex constructor when resolving, escape everything
            contractName: "\\$7e3e5a7c0842c8a92aaa4508b6debdcba8\\$",
            abi: utilitiesABI,
            binary: utilitiesBin,
        });
        let provider = new Web3.providers.HttpProvider(ethNodeUrl);
        utilitiesContract.setProvider(provider);
        let utilitiesLibrary = await utilitiesContract.new({from: from});
        utilitiesContract.address = utilitiesLibrary.address;
        let vaultFactoryABI = require('./generated/VaultFactory');
        let vaultFactoryBin = fs.readFileSync(__dirname + "/generated/VaultFactory.bin");
        let vaultFactoryContract = TruffleContract({
            contractName: "VaultFactory",
            abi: vaultFactoryABI,
            binary: vaultFactoryBin,
        });
        vaultFactoryContract.setProvider(provider);
        vaultFactoryContract.setNetwork(utilitiesContract.network_id);
        vaultFactoryContract.link(utilitiesContract);
        let vaultFactory = await vaultFactoryContract.new({from: from});
        return vaultFactory.address;
    }

    constructor(credentials, vaultFactory) {
        this.credentials = credentials;
        this.vaultFactory = vaultFactory;
    }

    async deployNewGatekeeper() {
        // TODO: figure out what is wrong with 'estimate gas'.
        //  Works for Truffle test, fails in Mocha test, doesn't give a "out of gas" in console;
        let receipt = await this.vaultFactory.newVault({from: this.credentials.getAddress(), gas: 0x6691b7});
        return new VaultCreatedEvent(receipt.logs[0]);
    }

    async getVaultCreatedEvent(options) {
        let events = await Utils.getEvents(this.vaultFactory, vaultCreatedEvent, options, VaultCreatedEvent);
        if(events.length !== 1){
            throw new Error("Invalid vault created events array size");
        }
        return events[0];
    }
}

module.exports = VaultFactoryContractInteractor;