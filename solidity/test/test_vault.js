const Web3 = require('web3');
const Chai = require('chai');
const testUtils = require('./utils');
const truffleUtils = require('../src/js/SafeChannelUtils');

const expect = Chai.expect;

Chai.use(require('ethereum-waffle').solidity);
Chai.use(require('bn-chai')(web3.utils.toBN));

const Vault = artifacts.require("./Vault.sol");
const DAI = artifacts.require("./DAI.sol");

const zeroAddr  = "0x0000000000000000000000000000000000000000";
const ETH_TOKEN_ADDRESS  = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

contract('Vault', function (accounts) {

    let vault;
    let erc20;
    let amount = 100;
    let fundedAmount = amount;
    let delay = 77;
    let from = accounts[0];
    let mockGK = accounts[0];
    let notGK = accounts[1];
    let destination = accounts[1];

    before(async function () {
        vault = await Vault.new(mockGK);
        erc20 = await DAI.new();
    });


    it("should fail to execute a delayed transfer transaction if not enough funds", async function () {
        let res = await vault.scheduleDelayedTransfer(delay, destination, amount, ETH_TOKEN_ADDRESS);
        let log = res.logs[0];
        assert.equal(log.event, "TransactionPending");
        let balance = parseInt(await web3.eth.getBalance(vault.address));
        assert.equal(balance, 0);

        await truffleUtils.increaseTime(3600 * 24 * 2 + 10, web3);

        console.log("log:", log)
        await expect(
            vault.applyDelayedTransfer(log.args.delay, log.args.destination, log.args.value, log.args.erc20token, log.args.nonce, accounts[0])
        ).to.be.revertedWith("Cannot transfer more then vault's balance");
    });

    it("should fail to execute a delayed ERC20 transfer transaction if not enough funds", async function () {
        let res = await vault.scheduleDelayedTransfer(delay, destination, amount, erc20.address);
        let log = res.logs[0];
        assert.equal(log.event, "TransactionPending");
        let balance = parseInt(await web3.eth.getBalance(vault.address));
        assert.equal(balance, 0);

        await truffleUtils.increaseTime(3600 * 24 * 2 + 10, web3);

        await expect(
            vault.applyDelayedTransfer(log.args.delay, log.args.destination, log.args.value, log.args.erc20token, log.args.nonce, accounts[0])
        ).to.be.revertedWith("Cannot transfer more then vault's balance");
    });


    /* Positive flows */

    it("should receive transfers and emit 'received' events", async function () {
        let res = await vault.sendTransaction({from: from, value: fundedAmount});
        let log = res.logs[0];

        assert.equal(from, log.args.sender);
        assert.equal(fundedAmount, log.args.value);
        assert.equal("FundsReceived", log.event);
    });

    it("should allow to create a delayed ETH transaction and execute it after delay expires", async function () {
        let res1 = await vault.scheduleDelayedTransfer(delay, destination, amount, ETH_TOKEN_ADDRESS);

        let log1 = res1.logs[0];
        assert.equal("TransactionPending", log1.event);
        await expect(
            vault.applyDelayedTransfer(log1.args.delay, log1.args.destination, log1.args.value, log1.args.erc20token, log1.args.nonce, accounts[0])
        ).to.be.revertedWith("applyDelayedTransfer called before due time");

        await truffleUtils.increaseTime(delay + 10, web3);

        let balanceSenderBefore = parseInt(await web3.eth.getBalance(vault.address));
        let balanceReceiverBefore = parseInt(await web3.eth.getBalance(destination));

        let nonce = log1.args.nonce.toString();
        let res2 = await vault.applyDelayedTransfer(log1.args.delay, log1.args.destination, log1.args.value, log1.args.erc20token, log1.args.nonce, accounts[0]);
        let log3 = res2.logs[0];

        assert.equal(log3.event, "TransactionCompleted");
        assert.equal(log3.args.destination, destination);
        assert.equal(log3.args.value, amount);
        assert.equal(log3.args.erc20token, 0);
        assert.equal(log3.args.nonce, nonce);

        let balanceSenderAfter = parseInt(await web3.eth.getBalance(vault.address));
        let balanceReceiverAfter = parseInt(await web3.eth.getBalance(destination));
        assert.equal(balanceSenderAfter, balanceSenderBefore - amount);
        assert.equal(balanceReceiverAfter, balanceReceiverBefore + amount);

    });

    it("funding the vault with ERC20 tokens", async function () {
        await testUtils.fundVaultWithERC20(vault,erc20,fundedAmount,from);
    });

    it("should allow to create a delayed ERC20 transaction and execute it after delay expires", async function () {

        let res1 = await vault.scheduleDelayedTransfer(delay, destination, amount, erc20.address);

        let log1 = res1.logs[0];
        assert.equal("TransactionPending", log1.event);
        await expect(
            vault.applyDelayedTransfer(log1.args.delay, log1.args.destination, log1.args.value, log1.args.erc20token, log1.args.nonce, accounts[0])
        ).to.be.revertedWith("applyDelayedTransfer called before due time");

        await truffleUtils.increaseTime(delay + 10, web3);

        let balanceSenderBefore = (await erc20.balanceOf(vault.address)).toNumber();
        let balanceReceiverBefore = (await erc20.balanceOf(destination)).toNumber();

        let nonce = log1.args.nonce.toString();
        let res2 = await vault.applyDelayedTransfer(log1.args.delay, log1.args.destination, log1.args.value, log1.args.erc20token, log1.args.nonce, accounts[0]);
        let log3 = res2.logs[0];
        let log4 = res2.logs[1];

        assert.equal(log3.event, "Transfer");
        assert.equal(log4.event, "TransactionCompleted");
        assert.equal(log4.args.destination, destination);
        assert.equal(log4.args.value, amount);
        assert.equal(log4.args.erc20token, erc20.address);
        assert.equal(log4.args.nonce, nonce);

        let balanceSenderAfter = (await erc20.balanceOf(vault.address)).toNumber();
        let balanceReceiverAfter = (await erc20.balanceOf(destination)).toNumber();
        assert.equal(balanceSenderAfter, balanceSenderBefore - amount);
        assert.equal(balanceReceiverAfter, balanceReceiverBefore + amount);
    });

    it("should allow to cancel ETH transaction before delay expires", async function () {
        let res1 = await vault.scheduleDelayedTransfer(delay, destination, amount, ETH_TOKEN_ADDRESS);

        let log1 = res1.logs[0];
        assert.equal("TransactionPending", log1.event);
        await expect(
            vault.applyDelayedTransfer(log1.args.delay, log1.args.destination, log1.args.value, log1.args.erc20token, log1.args.nonce, accounts[0])
        ).to.be.revertedWith("applyDelayedTransfer called before due time");


        res1 = await vault.cancelTransfer(log1.args.delay, log1.args.destination, log1.args.value, log1.args.erc20token, log1.args.nonce, accounts[0])
        assert.equal("TransactionCancelled", res1.logs[0].event);

    });

    it("should allow to cancel ERC20 transaction before delay expires", async function () {
        let res1 = await vault.scheduleDelayedTransfer(delay, destination, amount, erc20.address);

        let log1 = res1.logs[0];
        assert.equal("TransactionPending", log1.event);
        await expect(
            vault.applyDelayedTransfer(log1.args.delay, log1.args.destination, log1.args.value, log1.args.erc20token, log1.args.nonce, accounts[0])
        ).to.be.revertedWith("applyDelayedTransfer called before due time");

        res1 = await vault.cancelTransfer(log1.args.delay, log1.args.destination, log1.args.value, log1.args.erc20token, log1.args.nonce, accounts[0])
        assert.equal("TransactionCancelled", res1.logs[0].event);

    });

    /* Negative flows */


    it("should not allow to create a pending transactions for an unsupported ERC20 token");

    it("should not allow anyone except the 'gatekeeper' to perform any operation", async function () {
        await expect(
            vault.scheduleDelayedTransfer(delay, destination, amount, erc20.address, {from: notGK})
        ).to.be.revertedWith("Only Gatekeeper can access vault functions");
        await expect(
            vault.applyDelayedTransfer(delay, destination, amount, erc20.address, 0, zeroAddr, {from: notGK})
        ).to.be.revertedWith("Only Gatekeeper can access vault functions");
        await expect(
            vault.cancelTransfer(delay, destination, amount, erc20.address, 0, zeroAddr, {from: notGK})
        ).to.be.revertedWith("Only Gatekeeper can access vault functions");
    });

    after("write coverage report", async () => {
        await global.postCoverage()
    });
});
