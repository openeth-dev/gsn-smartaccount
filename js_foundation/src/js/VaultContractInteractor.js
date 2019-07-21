const Web3 = require('web3');
const TruffleContract = require("truffle-contract");
const {assert} = require('chai');

const VaultABI = require('./generated/Vault');
const GatekeeperABI = require('./generated/Gatekeeper');
const VaultFactoryABI = require('./generated/VaultFactory');

const ParticipantAddedEvent = require('./events/ParticipantAddedEvent');
const ParticipantRemovedEvent = require('./events/ParticipantRemovedEvent');
const GatekeeperInitializedEvent = require('./events/GatekeeperInitializedEvent');
const OwnerChangedEvent = require('./events/OwnerChangedEvent');


let GatekeeperContract = TruffleContract({
    contractName: "Gatekeeper",
    abi: GatekeeperABI
});

let VaultContract = TruffleContract({
    contractName: "Vault",
    abi: VaultABI
});

let VaultFactoryContract = TruffleContract({
    contractName: "VaultFactory",
    abi: VaultFactoryABI
});

const gatekeeperInitializedEvent = "GatekeeperInitialized";
const participantAddedEvent = "ParticipantAdded";
const participantRemovedEvent = "ParticipantRemoved";
const ownerChangedEvent = "OwnerChanged";
const levelFrozenEvent = "LevelFrozen";
const unfreezeCompletedEvent = "UnfreezeCompleted";


function getAllBlocksSinceVault() {
    let fromBlock = 0;
    if (this.initialConfigEvent){
        fromBlock = this.initialConfigEvent.blockNumber;
    }
    return {
        fromBlock: fromBlock,
        toBlock: 'latest'
    };
}

class VaultContractInteractor {

    /**
     * Factory method to create a new interactor object instance.
     * TODO: accept provider instead of 'account' to support different scenarios
     * @param account
     * @param ethNodeUrl
     * @param gatekeeperAddress
     * @param vaultAddress
     * @param vaultFactoryAddress
     * @returns {VaultContractInteractor}
     */
    static async connect(account, ethNodeUrl, gatekeeperAddress, vaultAddress, vaultFactoryAddress) {
        let provider = new Web3.providers.HttpProvider(ethNodeUrl);

        GatekeeperContract.setProvider(provider);
        VaultContract.setProvider(provider);
        VaultFactoryContract.setProvider(provider);

        let gatekeeper;
        if (gatekeeperAddress) {
            gatekeeper = await GatekeeperContract.at(gatekeeperAddress);
        }
        let vault;
        if (vaultAddress) {
            vault = await VaultContract.at(vaultAddress);
        }

        assert.exists(vaultFactoryAddress, "it is illegal to initialize the interactor without vault factory");
        let vaultFactory = await VaultFactoryContract.at(vaultFactoryAddress);

        let interactor = new VaultContractInteractor(account, gatekeeper, vault, vaultFactory);
        await interactor.getGatekeeperInitializedEvent();
        return interactor;
    }

    constructor(account, gatekeeper, vault, vaultFactory) {
        this.account = account;
        this.gatekeeper = gatekeeper;
        this.vault = vault;
        this.vaultFactory = vaultFactory;
    }

    async deployNewGatekeeper() {
        if (this.vault) {
            throw new Error("vault already deployed")
        }
        if (this.gatekeeper) {
            throw new Error("gatekeeper already deployed")
        }
        // TODO: figure out what is wrong with 'estimate gas'.
        //  Works for Truffle test, fails in Mocha test, doesn't give a "out of gas" in console;
        let receipt = await this.vaultFactory.newVault({from: this.account, gas: 0x6691b7});
        let vaultAddress = receipt.logs[0].args.vault;
        let gatekeeperAddress = receipt.logs[0].args.gatekeeper;
        this.vault = await VaultContract.at(vaultAddress);
        this.gatekeeper = await GatekeeperContract.at(gatekeeperAddress);
    }

    // ******* read from blockchain - general knowledge

    getGatekeeperAddress() {
        if (!this.gatekeeper) {
            return null;
        }
        return this.gatekeeperContract.address;
    }

    getVaultAddress() {

    }

    getVaultFactoryAddress() {

    }

    // ******* write to blockchain

    /**
     * Note: does not accept 'Vault' as a parameter; it's read from the Vault Factory event
     * @param participants - list of hashes of participants to add
     * @param delays
     */
    async initialConfig({participants, delays}) {
        // vaultParam, bytes32[] memory initialParticipants, uint[] memory initialDelays
        await this.gatekeeper.initialConfig(this.vault.address, participants, delays, {from: this.account});
    }

    async changeConfiguration() {

    }

    async boostedConfigChange() {

    }

    async freeze() {

    }

    async changeOwner() {

    }

    async cancelOperation() {

    }

    async applyBatch() {

    }

    async sendEther() {

    }

    async sendToken() {

    }

    async cancelTransfer() {

    }

    // ******* read from blockchain - gatekeeper
    async getOperator() {
        let operator = await this.gatekeeper.operator();
        // TODO: Decide if this is the logic that should be abstracted out of higher level code.
        if (operator === "0x0000000000000000000000000000000000000000") {
            return null;
        }
        return operator;
    }

    async getDelays() {
        let delays = await this.gatekeeper.getDelays();
        return delays.map(function (d) {
            return d.toNumber();
        });
    }

    async getGatekeeperInitializedEvent() {
        if (!this.gatekeeper || !this.vault){
            return null;
        }
        if (!this.initialConfigEvent) {
            let allBlocksEver = {fromBlock: 0, toBlock: 'latest'};
            let initialConfigEvents = await this.gatekeeper.getPastEvents(gatekeeperInitializedEvent, allBlocksEver);
            if (initialConfigEvents.length !== 1) {
                return null;
            }
            this.initialConfigEvent = new GatekeeperInitializedEvent(initialConfigEvents[0]);
        }
        return this.initialConfigEvent
    }

    async getParticipantAddedEvents(options) {
        let events = await this.gatekeeper.getPastEvents(participantAddedEvent, options || getAllBlocksSinceVault.call(this));
        return events.map(e => {
            new ParticipantAddedEvent(e);
        })
    }

    async getParticipantRemovedEvents(options) {
        let events = await this.gatekeeper.getPastEvents(participantAddedEvent, options || getAllBlocksSinceVault.call(this));
        return events.map(e => {
            new ParticipantRemovedEvent(e);
        })
    }

    async getOwnerChangedEvents(options) {
        let events = await this.gatekeeper.getPastEvents(ownerChangedEvent, options || getAllBlocksSinceVault.call(this));
        return events.map(e => {
            new OwnerChangedEvent(e);
        })
    }

    async getFreezeParameters() {
        return null;
    }

    async getScheduledOperations() {
        return [];
    }

    // ******* read from blockchain - vault

    async getScheduledTransfers() {

    }

    async getPastTransfers() {

    }

    async getBalance(tokenAddress) {

    }

}

module.exports = VaultContractInteractor;