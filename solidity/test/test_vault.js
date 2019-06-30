const Web3 = require('web3');
const Chai = require('chai');
const utils = require('./utils');

const expect = Chai.expect;

Chai.use(require('ethereum-waffle').solidity);
Chai.use(require('bn-chai')(web3.utils.toBN));

const Vault = artifacts.require("./Vault.sol");

contract('Vault', function (accounts) {

    let vault;
    let web3;
    let ethNodeUrl = "http://localhost:8545";
    let amount = 100;
    let delay = 77;
    let from = accounts[0];
    let destination = accounts[1];

    before(async function () {
        vault = await Vault.deployed();
        web3 = new Web3(new Web3.providers.HttpProvider(ethNodeUrl))
    });


    /* Positive flows */

    it("should receive transfers and emit 'received' events", async function () {
        let fundedAmount = amount * 3;
        let res = await vault.sendTransaction({from: from, value: fundedAmount});
        let log = res.logs[0];

        assert.equal(from, log.args.sender);
        assert.equal(fundedAmount, log.args.value);
        assert.equal("FundsReceived", log.event);
    });

    it("should allow to create a delayed ETH transaction and execute it after delay expires", async function () {
        let res1 = await vault.scheduleDelayedEtherTransfer(delay, destination, amount);

        let log1 = res1.logs[0];
        let log2 = res1.logs[1];
        assert.equal("DelayedOperation", log1.event);
        assert.equal("TransactionPending", log2.event);
        await expect(
            vault.applyDelayedTransfer(log1.args.operation, log1.args.opsNonce.toString())
        ).to.be.revertedWith("applyDelayedOps called before due time");

        await utils.increaseTime(delay + 10);

        let balanceSenderBefore = parseInt(await web3.eth.getBalance(vault.address));
        let balanceRecieverBefore = parseInt(await web3.eth.getBalance(destination));

        let opsNonce = log1.args.opsNonce.toString();
        let res2 = await vault.applyDelayedTransfer(log1.args.operation, opsNonce);
        let log3 = res2.logs[0];

        assert.equal(log3.event, "TransactionCompleted");
        assert.equal(log3.args.destination, destination);
        assert.equal(log3.args.value, amount);
        assert.equal(log3.args.erc20token, 0);
        assert.equal(log3.args.nonce, opsNonce);

        let balanceSenderAfter = parseInt(await web3.eth.getBalance(vault.address));
        let balanceReceiverAfter = parseInt(await web3.eth.getBalance(destination));
        assert.equal(balanceSenderAfter, balanceSenderBefore - amount);
        assert.equal(balanceReceiverAfter, balanceRecieverBefore + amount);

    });

    it("should allow to create a delayed ERC20 transaction and execute it after delay expires");

    it("should allow to cancel the transaction before delay expires");

    /* Negative flows */


    it("should not allow to create a pending transactions for an unsupported ERC20 token");

    it.skip("should not allow anyone except the 'gatekeeper' to perform any operation", async function () {
        await expect(
            // gatekeeper.cancelTransaction("0x123123")
        ).to.be.revertedWith("cannot cancel, operation does not exist");
    });

});
