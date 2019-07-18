const Web3 = require('web3');
const TruffleContract = require("truffle-contract");
const {assert} = require('chai');

const VaultABI = require('./generated/Vault');
const GatekeeperABI = require('./generated/Gatekeeper');
const VaultFactoryABI = require('./generated/VaultFactory');


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

class VaultContractInteractor {

    /**
     * Factory method to create a new interactor object instance.
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

        return new VaultContractInteractor(account, gatekeeper, vault, vaultFactory);
    }

    constructor(account, gatekeeper, vault, vaultFactory) {
        this.account = account;
        this.gatekeeper = gatekeeper;
        this.vault = vault;
        this.vaultFactory = vaultFactory;
    }

    async deployNewGatekeeper() {
        if (this.vault){
            throw new Error("vault already deployed")
        }
        if (this.gatekeeper){
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

    async initialConfig() {

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

    }

    async getDelays() {

    }

    async getCurrentParticipantsHashes() {

    }

    async getFreezeParameters() {

    }

    async getScheduledOperations() {

    }

    async getPastChanges(timeInterval) {

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