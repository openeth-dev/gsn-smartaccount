var Vault = artifacts.require("./Vault.sol");

contract('Vault', function (accounts) {

    /* Positive flows */

    it("should receive transfers and emit 'received' events");

    it("should allow to create a delayed ETH transaction and execute it after delay expires");

    it("should allow to create a delayed ERC20 transaction and execute it after delay expires");

    it("should allow to cancel the transaction before delay expires");

    /* Negative flows */


    it("should not allow to create a pending transactions for an unsupported ERC20 token");

    it("should not allow anyone except the 'gatekeeper' to perform any operation");

});
