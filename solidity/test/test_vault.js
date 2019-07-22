const Web3 = require('web3');
const Chai = require('chai');
const utils = require('./utils');
const truffleUtils = require('../src/js/SafeChannelUtils');

const expect = Chai.expect;

Chai.use(require('ethereum-waffle').solidity);
Chai.use(require('bn-chai')(web3.utils.toBN));

const Vault = artifacts.require("./Vault.sol");
const DAI = artifacts.require("./DAI.sol");

contract('Vault', function (accounts) {

    let vault;
    let erc20;
    let amount = 100;
    let fundedAmount = amount * 3;
    let delay = 77;
    let from = accounts[0];
    let destination = accounts[1];

    before(async function () {
        vault = await Vault.deployed();
        erc20 = await DAI.new();
    });


    it("should fail to execute a delayed transfer transaction if not enough funds", async function () {
        let res = await vault.scheduleDelayedEtherTransfer(delay, destination, amount);
        let log = res.logs[0];
        let balance = parseInt(await web3.eth.getBalance(vault.address));
        assert.equal(balance, 0);

        await truffleUtils.increaseTime(3600 * 24 * 2 + 10, web3);

        await expect(
            vault.applyDelayedTransfer(log.args.operation, log.args.opsNonce)
        ).to.be.revertedWith("Cannot transfer more then vault's balance");
    });

    it("should fail to execute a delayed ERC20 transfer transaction if not enough funds");


    /* Positive flows */

    it("should receive transfers and emit 'received' events", async function () {
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

        await truffleUtils.increaseTime(delay + 10, web3);

        let balanceSenderBefore = parseInt(await web3.eth.getBalance(vault.address));
        let balanceReceiverBefore = parseInt(await web3.eth.getBalance(destination));

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
        assert.equal(balanceReceiverAfter, balanceReceiverBefore + amount);

    });

    it("funding the vault with ERC20 tokens", async function () {
        let supply = (await erc20.totalSupply()).toNumber();
        let vaultBalanceBefore = await erc20.balanceOf(vault.address);
        let account0BalanceBefore = await erc20.balanceOf(from);
        assert.equal(0, vaultBalanceBefore.toNumber());
        assert.equal(supply, account0BalanceBefore.toNumber());

        let res = await erc20.transfer(vault.address, fundedAmount);

        assert.equal(res.logs[0].event, "Transfer");
        assert.equal(res.logs[0].args.value, fundedAmount);
        assert.equal(res.logs[0].args.from, from);
        assert.equal(res.logs[0].args.to, vault.address);

        let vaultBalanceAfter = await erc20.balanceOf(vault.address);
        let account0BalanceAfter = await erc20.balanceOf(from);
        assert.equal(fundedAmount, vaultBalanceAfter.toNumber());
        assert.equal(supply - fundedAmount, account0BalanceAfter.toNumber())

    });

    it("should allow to create a delayed ERC20 transaction and execute it after delay expires", async function () {

        let res1 = await vault.scheduleDelayedTokenTransfer(delay, destination, amount, erc20.address);

        let log1 = res1.logs[0];
        let log2 = res1.logs[1];
        assert.equal("DelayedOperation", log1.event);
        assert.equal("TransactionPending", log2.event);
        await expect(
            vault.applyDelayedTransfer(log1.args.operation, log1.args.opsNonce.toString())
        ).to.be.revertedWith("applyDelayedOps called before due time");

        await truffleUtils.increaseTime(delay + 10, web3);

        let balanceSenderBefore = (await erc20.balanceOf(vault.address)).toNumber();
        let balanceReceiverBefore = (await erc20.balanceOf(destination)).toNumber();

        let opsNonce = log1.args.opsNonce.toString();
        let res2 = await vault.applyDelayedTransfer(log1.args.operation, opsNonce);
        let log3 = res2.logs[0];
        let log4 = res2.logs[1];

        assert.equal(log3.event, "Transfer");
        assert.equal(log4.event, "TransactionCompleted");
        assert.equal(log4.args.destination, destination);
        assert.equal(log4.args.value, amount);
        assert.equal(log4.args.erc20token, erc20.address);
        assert.equal(log4.args.nonce, opsNonce);

        let balanceSenderAfter = (await erc20.balanceOf(vault.address)).toNumber();
        let balanceReceiverAfter = (await erc20.balanceOf(destination)).toNumber();
        assert.equal(balanceSenderAfter, balanceSenderBefore - amount);
        assert.equal(balanceReceiverAfter, balanceReceiverBefore + amount);
    });

    it("should allow to cancel the transaction before delay expires");

    /* Negative flows */


    it("should not allow to create a pending transactions for an unsupported ERC20 token");

    it.skip("should not allow anyone except the 'gatekeeper' to perform any operation", async function () {
        await expect(
            // gatekeeper.cancelTransaction("0x123123")
        ).to.be.revertedWith("cannot cancel, operation does not exist");
    });

    after("write coverage report", async () => {
        await global.postCoverage()
    });
});
