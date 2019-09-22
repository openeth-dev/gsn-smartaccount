const TruffleContract = require("truffle-contract");
const Web3 = require('web3');

const VaultFactoryABI = require('./generated/VaultFactory');

let VaultFactoryContract = TruffleContract({
    contractName: "VaultFactory",
    abi: VaultFactoryABI
});

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
        VaultFactoryContract.setProvider(provider);
        let vaultFactory = await VaultFactoryContract.at(vaultFactoryAddress);
        return new VaultFactoryContractInteractor(credentials, vaultFactory)
    }

    constructor(credentials, vaultFactory) {
        this.credentials = credentials;
        this.vaultFactory = vaultFactory;
    }

    async deployNewGatekeeper() {
        // TODO: figure out what is wrong with 'estimate gas'.
        //  Works for Truffle test, fails in Mocha test, doesn't give a "out of gas" in console;
        let receipt = await this.vaultFactory.newVault({from: this.credentials.getAddress(), gas: 0x6691b7});
        let vaultAddress = receipt.logs[0].args.vault;
        let gatekeeperAddress = receipt.logs[0].args.gatekeeper;
        return {
            vault: vaultAddress,
            gatekeeper: gatekeeperAddress
        };
    }
}

module.exports = VaultFactoryContractInteractor;