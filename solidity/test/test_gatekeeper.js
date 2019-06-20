const Gatekeeper = artifacts.require("./Gatekeeper.sol");
const Vault = artifacts.require("./Vault.sol");
const Chai = require('chai');
const Web3 = require('web3');
const ABI = require('ethereumjs-abi');

const utils = require('./utils');

const expect = Chai.expect;

// const {createMockProvider, deployContract, getWallets, solidity} = ;
Chai.use(require('ethereum-waffle').solidity);
Chai.use(require('bn-chai')(web3.utils.toBN));

contract.only('Gatekeeper', async function (accounts) {

    let gatekeeper;
    let vault;
    let from = accounts[0];
    let wrongaddr = accounts[1];
    let destinationAddresss = accounts[2];
    let amount = 100;
    let delay = 77;
    let startBlock;
    let web3;
    let expectedDelayedEventsCount = 0;

    before(async function () {
        gatekeeper = await Gatekeeper.deployed();
        vault = await Vault.deployed();
        web3 = new Web3(gatekeeper.contract.currentProvider);
        startBlock = await web3.eth.getBlockNumber();
        await gatekeeper.setVault(vault.address);
        await gatekeeper.setSpender(from);
        await gatekeeper.setDelay(delay);
    });

    async function getLastEvent(contract, event, expectedCount) {
        let delayedEvents = await contract.getPastEvents(event, {
            fromBlock: startBlock,
            toBlock: 'latest'
        });
        // If 'contract' changes, just make sure to take the right one
        assert.equal(delayedEvents.length, expectedCount);
        return delayedEvents[delayedEvents.length - 1].returnValues;
    }

    /* Positive flows */

    /* Plain send */
    it("should allow the owner to create a delayed transaction", async function () {
        let res = await gatekeeper.sendEther(destinationAddresss, amount);
        expectedDelayedEventsCount++;
        let encodedAbiCall = vault.contract.methods.applyDelayedTransaction(gatekeeper.address, delay, destinationAddresss, amount).encodeABI();
        let log = res.logs[0];
        assert.equal(log.event, "DelayedOperation");
        // Vault sees the transaction as originating from Gatekeeper
        // and it does not know or care which participant initiated it
        assert.equal(log.args.sender, gatekeeper.address);
        assert.equal(log.args.operation, encodedAbiCall);
    });

    it("should fail to execute a delayed transfer transaction if not enough funds", async function () {
        let addedLog = await getLastEvent(vault.contract, "DelayedOperation", expectedDelayedEventsCount);
        let balance = parseInt(await web3.eth.getBalance(vault.address));
        assert.equal(balance, 0);

        await utils.increaseTime(3600 * 24 * 2 + 10);

        await expect(
            vault.applyDelayedOpsPublic(addedLog.operation, addedLog.opsNonce)
        ).to.be.revertedWith("Cannot transfer more then vault's balance");
    });

    it("just funding the vault", async function () {
        await web3.eth.sendTransaction({from: from, to: vault.address, value: amount * 10});
    });

    it("should allow the owner to execute a delayed transfer transaction after delay", async function () {

        let addedLog = await getLastEvent(vault.contract, "DelayedOperation", expectedDelayedEventsCount);
        let balanceSenderBefore = parseInt(await web3.eth.getBalance(vault.address));
        let balanceRecieverBefore = parseInt(await web3.eth.getBalance(destinationAddresss));
        assert.isAbove(balanceSenderBefore, amount);
        await utils.increaseTime(3600 * 24 * 2 + 10);

        let res = await vault.applyDelayedOpsPublic(addedLog.operation, addedLog.opsNonce);
        let log = res.logs[1];

        assert.equal(log.event, "FundsKindaTransferred");
        assert.equal(log.args.destination, destinationAddresss);
        assert.equal(log.args.value, amount);

        let balanceSenderAfter = parseInt(await web3.eth.getBalance(vault.address));
        let balanceRecieverAfter = parseInt(await web3.eth.getBalance(destinationAddresss));
        assert.equal(balanceSenderAfter, balanceSenderBefore - amount);
        assert.equal(balanceRecieverAfter, balanceRecieverBefore + amount);
    });


    /* Canceled send */
    it("should revert when trying to cancel a transfer transaction that does not exist", async function () {
        await expect(
            gatekeeper.cancelTransaction("0x123123")
        ).to.be.revertedWith("cannot cancel, operation does not exist");
    });

    it("should allow the owner to cancel a delayed transfer transaction", async function () {
        let res1 = await gatekeeper.sendEther(destinationAddresss, amount);
        expectedDelayedEventsCount++;
        let encoded = res1.logs[0].args.operation;
        let encodedBuff = Buffer.from(encoded.slice(2), "hex");
        let opsNonce = res1.logs[0].args.opsNonce.toNumber();
        let hash = ABI.soliditySHA3(["bytes", "uint256"],[encodedBuff, opsNonce]);
        let res2 = await gatekeeper.cancelTransaction(hash);
        console.log(res2, res2.logs)
        let log = res2.logs[0];
        assert.equal(log.event, "DelayedOperationCancelled");
        assert.equal(log.args.hash, "0x" + hash.toString("hex"));
        assert.equal(log.args.sender, gatekeeper.address);
    });

    /** Batch config operations **/
    it("should allow the admin to create batched config changes");

    /* Rejected send */
    it("should allow the admin to cancel a delayed transaction");

    /* Admin replaced */
    it("should allow the admin to replace another admin after a delay");

    /* Owner loses phone*/
    it("should allow the admin to replace the owner after a delay");

    /* Owner finds the phone after losing it */
    it("should allow the owner to cancel an owner change");

    /* Owner finds the phone after losing it */
    it("should allow the admin to cancel an owner change");

    /* doomsday recover: all participants malicious */
    it("should allow the super-admin to lock out all participants, cancel all operations and replace all participants");

    /* Negative flows */

    /* Owner’s phone controlled by a malicious operator */
    it("should not allow the owner to cancel an owner change if an admin locks him out");

    /* Plain send - opposite */
    it("should not allow non-owner to create a delayed transaction", async function () {
        await expect(
            gatekeeper.contract.methods.sendEther(destinationAddresss, amount).send({from: wrongaddr})
        ).to.be.revertedWith("Only spender can perform send operations!");
    });

    /* Admin replaced - opposite  & Owner loses phone - opposite */
    it("should not allow non-admin to replace admins or owners");


});