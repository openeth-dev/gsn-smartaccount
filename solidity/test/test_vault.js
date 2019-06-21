const Web3 = require('web3');
const utils = require('./utils');


const Vault = artifacts.require("./Vault.sol");

contract('Vault', function (accounts) {

    let vault;
    let web3;
    let ethNodeUrl = "http://localhost:8545";
    let fromAddress = accounts[0];

    before(async function () {
        vault = await Vault.deployed();
        web3 = new Web3(new Web3.providers.HttpProvider(ethNodeUrl))
    });


    /* Positive flows */

    it("should receive transfers and emit 'received' events", async function () {
        let value = 777;
        let res = await vault.sendTransaction({from: fromAddress, value: value});
        let log = res.logs[0];

        assert.equal(fromAddress, log.args.sender);
        assert.equal(value, log.args.value);
        assert.equal("FundsReceived", log.event);
    });

    it.skip("should allow to create a delayed ETH transaction and execute it after delay expires", async function () {
        let res = await vault.sendDelayedTransaction(2);

        let log = res.logs[0];
        assert.equal("TransactionPending", log.event);

        await utils.increaseTime(10);
        assert.equal(1, 2);

    });

    it("should allow to create a delayed ERC20 transaction and execute it after delay expires");

    it("should allow to cancel the transaction before delay expires");

    /* Negative flows */


    it("should not allow to create a pending transactions for an unsupported ERC20 token");

    it("should not allow anyone except the 'gatekeeper' to perform any operation");

});
