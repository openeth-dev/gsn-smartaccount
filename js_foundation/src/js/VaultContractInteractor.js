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
const DelayedOperationEvent = require('./events/DelayedOperationEvent');
const DelayedOperationCancelledEvent = require('./events/DelayedOperationCancelledEvent');
const DelayedOperationComplete = require('./events/DelayedOperationCompleteEvent');
const LevelFrozenEvent = require("./events/LevelFrozenEvent");
const UnfreezeCompletedEvent = require("./events/UnfreezeCompletedEvent");
const TransactionCompletedEvent = require("./events/TransactionCompletedEvent");
const TransactionPendingEvent = require("./events/TransactionPendingEvent");

const TransactionReceipt = require("./TransactionReceipt");

const safeChannelUtils = require("../../../solidity/src/js/SafeChannelUtils");

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
const delayedOperationEvent = "DelayedOperation";
const delayedOperationCompleteEvent = "DelayedOperationComplete";
const delayedOperationCancelledEvent = "DelayedOperationCancelled";
const transactionPendingEvent = "TransactionPending";
const transactionCompletedEvent = "TransactionCompleted";


class VaultContractInteractor {

    /**
     * Factory method to create a new interactor object instance.
     * TODO: accept provider instead of 'account' to support different scenarios
     * @param account
     * @param permissions
     * @param level
     * @param ethNodeUrl
     * @param gatekeeperAddress
     * @param vaultAddress
     * @param vaultFactoryAddress
     * @returns {VaultContractInteractor}
     */
    static async connect(account, permissions, level, ethNodeUrl, gatekeeperAddress, vaultAddress, vaultFactoryAddress) {
        let provider = new Web3.providers.HttpProvider(ethNodeUrl);
        let web3 = new Web3(provider);
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

        let interactor = new VaultContractInteractor(web3, account, permissions, level, gatekeeper, vault, vaultFactory);
        await interactor.getGatekeeperInitializedEvent();
        return interactor;
    }

    constructor(web3, account, permissions, level, gatekeeper, vault, vaultFactory) {
        this.web3 = web3;
        this.permissions = permissions;
        this.level = level;
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
        await this.gatekeeper.initialConfig(this.vault.address, participants, delays, {from: this.account});
    }

    // TODO 2 : accept hashes here in 'toAdd'/'remove'! Should not perform 'pack' stuff. Just till contract 'add'
    // Unfreeze currently cannot be called here as it always requires boost.
    // Change owner can be batched here but not required by the spec, so won't bother
    async changeConfiguration({participantsToAdd, participantsToRemove, unfreeze}) {
        let operations = this._getOperations(participantsToAdd, participantsToRemove, unfreeze);
        let encodedPacked = safeChannelUtils.encodePackedBatch(operations);
        let web3receipt = await this.gatekeeper.changeConfiguration(this._myPermLevel(), encodedPacked, {from: this.account});
        return new TransactionReceipt(web3receipt.receipt)
    }

    async signBoostedConfigChange({participantsToAdd, participantsToRemove, unfreeze}) {
        let operations = this._getOperations(participantsToAdd, participantsToRemove, unfreeze);
        let encodedPacked = safeChannelUtils.encodePackedBatch(operations);
        let encodedHash = safeChannelUtils.getTransactionHash(encodedPacked);
        let signature = await safeChannelUtils.signMessage(encodedHash, this.web3, {from: this.account});
        return {operation: safeChannelUtils.bufferToHex(encodedPacked), signature: signature};
    }

    async scheduleBoostedConfigChange({operation, signature, signerPermsLevel}) {
        let web3receipt = await this.gatekeeper.boostedConfigChange(
            this._myPermLevel(), signerPermsLevel, operation, signature, {from: this.account});
        return new TransactionReceipt(web3receipt.receipt);
    }

    async freeze(level, interval) {
        let web3receipt = await this.gatekeeper.freeze(this._myPermLevel(), level, interval, {from: this.account});
        return new TransactionReceipt(web3receipt.receipt);
    }

    async scheduleChangeOwner(newOwner) {
        let web3receipt = await this.gatekeeper.scheduleChangeOwner(this._myPermLevel(), newOwner, {from: this.account});
        return new TransactionReceipt(web3receipt);
    }

    async cancelOperation() {

    }

    // Currently, only applies operations scheduled by himself.
    async applyBatch(batchOperation, nonce, booster) {
        let boosterAddress;
        let boosterPermsLevel;
        if (booster === undefined) {
            boosterAddress = "0x0000000000000000000000000000000000000000";
            boosterPermsLevel = "0";
        } else {
            boosterAddress = booster.address;
            boosterPermsLevel = booster.permLevel;
        }
        let schedulerAddress = this.account;
        let schedulerPermsLevel = this._myPermLevel();
        let senderPermsLevel = this._myPermLevel();

        let web3receipt = await this.gatekeeper.applyBatch(
            schedulerAddress,
            schedulerPermsLevel,
            boosterAddress,
            boosterPermsLevel,
            batchOperation,
            senderPermsLevel,
            nonce,
            {from: this.account});
        return new TransactionReceipt(web3receipt);
    }

    async applyTransfer({operation, nonce}) {
        let web3receipt = await this.gatekeeper.applyTransfer(
            operation,
            nonce,
            this._myPermLevel(),
            {from: this.account});
        return new TransactionReceipt(web3receipt);
    }

    async sendEther({destination, value}) {
        let web3receipt = await this.gatekeeper.sendEther(
            destination,
            value,
            this._myPermLevel(),
            {from: this.account});
        return new TransactionReceipt(web3receipt);
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

    async getFreezeParameters() {
        let frozenLevel = (await this.gatekeeper.frozenLevel()).toNumber();
        let frozenUntil = (await this.gatekeeper.frozenUntil()).toNumber();
        return {frozenLevel, frozenUntil};
    }


    // ******* read from blockchain - events

    async getGatekeeperInitializedEvent() {
        if (!this.gatekeeper || !this.vault) {
            return null;
        }
        if (!this.initialConfigEvent) {
            let allBlocksEver = {fromBlock: 0, toBlock: 'latest'};
            let initialConfigEvents = await this._getEvents(this.gatekeeper, gatekeeperInitializedEvent, allBlocksEver, GatekeeperInitializedEvent);
            if (initialConfigEvents.length === 0) {
                return null;
            }
            if (initialConfigEvents.length > 1) {
                throw new Error("Multiple 'GatekeeperInitialized' events emitted by this contract, it's impossible!");
            }

            this.initialConfigEvent = initialConfigEvents[0];
        }
        return this.initialConfigEvent
    }


    async getParticipantAddedEvents(options) {
        return await this._getEvents(this.gatekeeper, participantAddedEvent, options, ParticipantAddedEvent);
    }

    async getParticipantRemovedEvents(options) {
        return await this._getEvents(this.gatekeeper, participantRemovedEvent, options, ParticipantRemovedEvent);
    }

    async getOwnerChangedEvents(options) {
        return await this._getEvents(this.gatekeeper, ownerChangedEvent, options, OwnerChangedEvent);
    }

    async getLevelFrozenEvents(options) {
        return await this._getEvents(this.gatekeeper, levelFrozenEvent, options, LevelFrozenEvent);
    }

    async getUnfreezeCompletedEvents(options) {
        return await this._getEvents(this.gatekeeper, unfreezeCompletedEvent, options, UnfreezeCompletedEvent);
    }

    async getDelayedOperationsEvents(options) {
        return await this._getEvents(this.gatekeeper, delayedOperationEvent, options, DelayedOperationEvent);
    }

    async getDelayedOperationsEventsForVault(options) {
        return await this._getEvents(this.vault, delayedOperationEvent, options, DelayedOperationEvent);
    }

    async getDelayedOperationsCancelledEvents(options) {
        return await this._getEvents(this.gatekeeper, delayedOperationCancelledEvent, options, DelayedOperationCancelledEvent);
    }

    async getDelayedOperationsCancelledEventsForVault(options) {
        return await this._getEvents(this.vault, delayedOperationCancelledEvent, options, DelayedOperationCancelledEvent);
    }

    async getDelayedOperationsCompleteEvents(options) {
        return await this._getEvents(this.gatekeeper, delayedOperationCompleteEvent, options, DelayedOperationComplete);
    }

    // TODO: Do we need this event? Maybe could use the one from DelayedOps
    async getTransactionCompletedEvents(options) {
        return await this._getEvents(this.vault, transactionCompletedEvent, options, TransactionCompletedEvent);
    }

    async getTransactionPendingEvents(options) {
        return await this._getEvents(this.vault, transactionPendingEvent, options, TransactionPendingEvent);
    }


    // ******* read from blockchain - vault

    async getPastTransfers() {

    }

    async getBalance(tokenAddress) {
        if (!tokenAddress) {
            return parseInt(await this.web3.eth.getBalance(this.vault.address));
        }
    }


    //**************** Internal methods - should not expose (not supported in ES6)


    _getOperations(participantsToAdd, participantsToRemove, unfreeze) {
        let operations = [];
        if (participantsToAdd) {
            this._populateWithAddOperations(participantsToAdd, operations);
        }
        if (participantsToRemove) {
            this._populateWithRemoveOperations(participantsToRemove, operations);
        }
        if (unfreeze) {
            let unfreezeOp = this._encodeOperation([], this.gatekeeper.contract.methods.unfreeze);
            operations.push(unfreezeOp)
        }
        return operations;
    }

    _populateWithRemoveOperations(participantsToRemove, operations) {
        participantsToRemove.forEach(participant => {
            let method = this.gatekeeper.contract.methods.removeParticipant;
            let operation = this._encodeOperation([participant.hash], method);
            operations.push(operation);
        });
    }

    _populateWithAddOperations(participantsToAdd, operations) {
        participantsToAdd.forEach(participant => {
            let address = participant.address;
            let permLevel = safeChannelUtils.packPermissionLevel(participant.permissions, participant.level);
            let method = this.gatekeeper.contract.methods.addParticipant;
            let operation = this._encodeOperation([address, permLevel], method);
            operations.push(operation);
        });
    }

    _encodeOperation(extraArgs, method) {
        let callArguments = [
            this.account,
            this._myPermLevel(),
            ...extraArgs
        ];
        return method(...callArguments).encodeABI()
    }

    _myPermLevel() {
        return safeChannelUtils.packPermissionLevel(this.permissions, this.level);
    }

    _getAllBlocksSinceVault() {
        let fromBlock = 0;
        if (this.initialConfigEvent) {
            fromBlock = this.initialConfigEvent.blockNumber;
        }
        return {
            fromBlock: fromBlock,
            toBlock: 'latest'
        };
    }

    async _getEvents(contract, eventName, options, constructor) {
        let events = await contract.getPastEvents(eventName, options || this._getAllBlocksSinceVault());
        return events.map(e => {
            return new constructor(e);
        })
    }

}

module.exports = VaultContractInteractor;