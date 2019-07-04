const Gatekeeper = artifacts.require("./Gatekeeper.sol");
const Vault = artifacts.require("./Vault.sol");
const Chai = require('chai');
const Web3 = require('web3');

const utils = require('./utils');

const expect = Chai.expect;

Chai.use(require('ethereum-waffle').solidity);
Chai.use(require('bn-chai')(web3.utils.toBN));

function getDelayedOpHashFromEvent(log) {
    let sender = log.args.sender;
    let extraData = log.args.extraData.toNumber();
    let opsNonce = log.args.opsNonce.toNumber();
    let encoded = log.args.operation;
    let encodedBuff = Buffer.from(encoded.slice(2), "hex");
    return utils.delayedOpHash(sender, extraData, opsNonce, encodedBuff);
}

async function callDelayed(method, gatekeeper, callArguments, options, senderPermissions = 0) {
    let encodedABI = method(...callArguments).encodeABI();
    let encodedPacked = utils.encodePackedBatch([encodedABI]);
    // TODO: #1 this is a disaster, refactor!
    return await gatekeeper.changeConfiguration(options.from, senderPermissions, encodedPacked, options);
}

let asyncForEach = async function (array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
};

contract('Gatekeeper', async function (accounts) {

    let gatekeeper;
    let vault;
    let level = 1;
    let from = accounts[0];
    let wrongaddr = accounts[1];
    let destinationAddresss = accounts[2];
    let adminA = accounts[3];
    let adminB = accounts[4];
    let adminB1 = accounts[5];
    let adminC = accounts[6];
    let watchdogA = accounts[7];
    let watchdogB = accounts[8];
    let watchdogB1 = accounts[9];
    let watchdogC = accounts[10];
    let amount = 100;
    let delay = 77;
    let startBlock;
    let web3;
    let expectedDelayedEventsCount = 0;
    let ownerPermissions;
    let adminPermissions;
    let watchdogPermissions;

    before(async function () {
        gatekeeper = await Gatekeeper.deployed();
        vault = await Vault.deployed();
        web3 = new Web3(gatekeeper.contract.currentProvider);
        ownerPermissions = utils.bufferToHex(await gatekeeper.ownerPermissions());
        adminPermissions = utils.bufferToHex(await gatekeeper.adminPermissions());
        watchdogPermissions = utils.bufferToHex(await gatekeeper.watchdogPermissions());
        console.log(`ownerPermissions: ${ownerPermissions}`);
        console.log(`adminPermissions: ${adminPermissions}`);
        console.log(`watchdogPermissions: ${watchdogPermissions}}`);
        startBlock = await web3.eth.getBlockNumber();
        await gatekeeper.setVault(vault.address);
        await gatekeeper.setOperator(from);
        await gatekeeper.addParticipantInit(adminA, adminPermissions, level);
        await gatekeeper.addParticipantInit(adminB, adminPermissions, level);
        await gatekeeper.addParticipantInit(watchdogA, watchdogPermissions, level);
        await gatekeeper.addParticipantInit(watchdogB, watchdogPermissions, level);
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
    it("should allow the owner to create a delayed ether transfer transaction", async function () {
        let res = await gatekeeper.sendEther(destinationAddresss, amount, ownerPermissions);
        expectedDelayedEventsCount++;
        // TODO: go through gatekeeper::applyTransfer
        let nonceInExtraData = 0;
        let encodedABI = vault.contract.methods.transferETH(gatekeeper.address, nonceInExtraData, destinationAddresss, amount).encodeABI();
        let encodedPacked = utils.bufferToHex(utils.encodePackedBatch([encodedABI]));
        let log = res.logs[0];
        assert.equal(log.event, "DelayedOperation");
        assert.equal(log.address, vault.address);
        // Vault sees the transaction as originating from Gatekeeper
        // and it does not know or care which participant initiated it
        assert.equal(log.args.sender, gatekeeper.address);
        assert.equal(log.args.operation, encodedPacked);
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

        let res = await gatekeeper.applyTransfer(addedLog.operation, addedLog.opsNonce, ownerPermissions);
        let log = res.logs[0];

        assert.equal(log.event, "TransactionCompleted");
        assert.equal(log.args.destination, destinationAddresss);
        assert.equal(log.args.value, amount);

        let balanceSenderAfter = parseInt(await web3.eth.getBalance(vault.address));
        let balanceReceiverAfter = parseInt(await web3.eth.getBalance(destinationAddresss));
        assert.equal(balanceSenderAfter, balanceSenderBefore - amount);
        assert.equal(balanceReceiverAfter, balanceRecieverBefore + amount);
    });


    /* Canceled send, rejected send */

    it("should revert when trying to cancel a transfer transaction that does not exist", async function () {
        await expect(
            gatekeeper.cancelTransfer("0x123123")
        ).to.be.revertedWith("cannot cancel, operation does not exist");
    });

    [{address: from, title: "owner"}, {address: watchdogA, title: "watchdog"}].forEach((participant) => {
        it(`should allow the ${participant.title} to cancel a delayed transfer transaction`, async function () {
            let res1 = await gatekeeper.sendEther(destinationAddresss, amount, ownerPermissions);
            expectedDelayedEventsCount++;
            let hash = getDelayedOpHashFromEvent(res1.logs[0]);
            let res2 = await gatekeeper.cancelTransfer(hash, {from: participant.address});
            let log = res2.logs[0];
            assert.equal(log.event, "DelayedOperationCancelled");
            assert.equal(log.address, vault.address);
            assert.equal(log.args.hash, "0x" + hash.toString("hex"));
            assert.equal(log.args.sender, gatekeeper.address);
        });
    });

    it("should allow the owner to create a delayed config transaction", async function () {
        let encodedABI = gatekeeper.contract.methods.addParticipant(from, ownerPermissions, adminB1, ownerPermissions, level).encodeABI();
        let encodedPacked = utils.encodePackedBatch([encodedABI]);

        let res = await callDelayed(gatekeeper.contract.methods.addParticipant, gatekeeper, [from, ownerPermissions, adminB1, ownerPermissions, level], {from: from}, ownerPermissions);
        let log = res.logs[0];
        assert.equal(log.event, "DelayedOperation");
        assert.equal(log.address, gatekeeper.address);
        assert.equal(log.args.sender, from);
        assert.equal(log.args.operation, utils.bufferToHex(encodedPacked));
    });

    it("should store admins' credentials hashed", async function () {
        let hash = utils.bufferToHex(utils.participantHash(adminA, adminPermissions, level));
        let isAdmin = await gatekeeper.participants(hash);
        assert.equal(true, isAdmin);
    });

    /* Rejected config change */
    it("should allow the watchdog to cancel a delayed config transaction", async function () {
        let log = await utils.extractLastDelayedOpsEvent(gatekeeper);
        let hash = getDelayedOpHashFromEvent(log);
        let res2 = await gatekeeper.cancelOperation(hash, {from: watchdogA});
        let log2 = res2.logs[0];
        assert.equal(log2.event, "DelayedOperationCancelled");
        assert.equal(log2.address, gatekeeper.address);
        assert.equal(log2.args.hash, "0x" + hash.toString("hex"));
        assert.equal(log2.args.sender, watchdogA);

        await utils.validateAdminsConfig([adminA, adminB, adminB1], [1, 1, 1], [true, true, false], gatekeeper, Array(3).fill(adminPermissions));
    });

    it("should revert an attempt to delete admin that is not a part of the config", async function () {
        let res = await callDelayed(gatekeeper.contract.methods.removeParticipant, gatekeeper, [from, ownerPermissions, utils.participantHash(adminC, adminPermissions, level)], {from: from}, ownerPermissions);
        let log = res.logs[0];
        assert.equal(log.event, "DelayedOperation");
        await utils.increaseTime(3600 * 24 * 2 + 10);
        await expect(
            gatekeeper.applyBatch(res.logs[0].args.operation, ownerPermissions, res.logs[0].args.opsNonce.toString())
        ).to.be.revertedWith("there is no such participant");
    });

    it("should allow the owner to add an admin after a delay", async function () {
        let res = await callDelayed(gatekeeper.contract.methods.addParticipant, gatekeeper, [from, ownerPermissions, adminC, adminPermissions, level], {from: from}, ownerPermissions);
        await expect(
            gatekeeper.applyBatch(res.logs[0].args.operation, ownerPermissions, res.logs[0].args.opsNonce.toString())
        ).to.be.revertedWith("called before due time");
        await utils.increaseTime(3600 * 24 * 2 + 10);
        let res2 = await gatekeeper.applyBatch(res.logs[0].args.operation, ownerPermissions, res.logs[0].args.opsNonce.toString());
        let log2 = res2.logs[0];
        let hash = utils.bufferToHex(utils.participantHash(adminC, adminPermissions, level));
        assert.equal(log2.event, "ParticipantAdded");
        assert.equal(log2.args.participant, hash);
        await utils.validateAdminsConfig([adminA, adminB, adminB1, adminC], [1, 1, 1, 1], [true, true, false, true], gatekeeper, Array(4).fill(adminPermissions));
    });

    it("should allow the owner to delete an admin after a delay", async function () {
        let res = await callDelayed(gatekeeper.contract.methods.removeParticipant, gatekeeper, [from, ownerPermissions, utils.participantHash(adminC, adminPermissions, level)], {from: from}, ownerPermissions);
        let log = res.logs[0];
        assert.equal(log.event, "DelayedOperation");
        await utils.increaseTime(3600 * 24 * 2 + 10);
        let res2 = await gatekeeper.applyBatch(res.logs[0].args.operation, ownerPermissions, res.logs[0].args.opsNonce.toString());
        assert.equal(res2.logs[0].event, "ParticipantRemoved");
        await utils.validateAdminsConfig([adminA, adminB, adminB1, adminC], [1, 1, 1, 1], [true, true, false, false], gatekeeper, Array(4).fill(adminPermissions));

    });

    /* Admin replaced */
    it("should allow the owner to replace an admin after a delay", async function () {
        let encodedABI_add_adminB1 = gatekeeper.contract.methods.addParticipant(from, ownerPermissions, adminB1, adminPermissions, level).encodeABI();
        let encodedABI_remove_adminB = gatekeeper.contract.methods.removeParticipant(from, ownerPermissions, utils.participantHash(adminB, adminPermissions, level)).encodeABI();
        let encodedPacked = utils.encodePackedBatch([encodedABI_add_adminB1, encodedABI_remove_adminB]);
        let res = await gatekeeper.changeConfiguration(from, ownerPermissions, encodedPacked);

        await expect(
            gatekeeper.applyBatch(res.logs[0].args.operation, ownerPermissions, res.logs[0].args.opsNonce.toString())
        ).to.be.revertedWith("called before due time");

        await utils.increaseTime(3600 * 24 * 2 + 10);

        let res2 = await gatekeeper.applyBatch(res.logs[0].args.operation, ownerPermissions, res.logs[0].args.opsNonce.toString());

        assert.equal(res2.logs[0].event, "ParticipantAdded");
        assert.equal(res2.logs[1].event, "ParticipantRemoved");

        await utils.validateAdminsConfig([adminA, adminB, adminB1, adminC], [1, 1, 1, 1], [true, false, true, false], gatekeeper, Array(4).fill(adminPermissions));
    });

    it("should only allow one operator in vault", async function () {
        // as we keep the 'require'-ment to use pre-approved permissions, operator
        // is defined as an account with 'ownerPermissions'
        let res1 = await callDelayed(gatekeeper.contract.methods.addParticipant, gatekeeper, [from, ownerPermissions, wrongaddr, ownerPermissions, level], {from: from}, ownerPermissions);
        await utils.increaseTime(3600 * 24 * 2 + 10);
        await gatekeeper.applyBatch(res1.logs[0].args.operation, ownerPermissions, res1.logs[0].args.opsNonce.toString());
        // as per spec file, another 'operator' can be added as a participant, but cannot use it's permissions
        await utils.validateAdminsConfig([wrongaddr], [1], [true], gatekeeper, [ownerPermissions]);

        await expect(
            callDelayed(gatekeeper.contract.methods.addParticipant, gatekeeper, [wrongaddr, ownerPermissions, wrongaddr, ownerPermissions, level], {from: wrongaddr}, ownerPermissions)
        ).to.be.revertedWith("This participant is not a real operator, fix your vault configuration.");

        // Clean up
        let res2 = await callDelayed(gatekeeper.contract.methods.removeParticipant, gatekeeper, [from, ownerPermissions, utils.participantHash(wrongaddr, ownerPermissions, level)], {from: from}, ownerPermissions);
        await utils.increaseTime(3600 * 24 * 2 + 10);
        await gatekeeper.applyBatch(res2.logs[0].args.operation, ownerPermissions, res2.logs[0].args.opsNonce.toString());
    });

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
    it("should not allow non-owner to create a delayed transfer transaction", async function () {
        // Not participant will not be found (regardless of claimed permissions, cannot test that)
        await expect(
            gatekeeper.contract.methods.sendEther(destinationAddresss, amount, ownerPermissions).send({from: wrongaddr})
        ).to.be.revertedWith("not participant");
        // Participant claiming permissions he doesn't have will not be found as well
        await expect(
            gatekeeper.contract.methods.sendEther(destinationAddresss, amount, ownerPermissions).send({from: adminA})
        ).to.be.revertedWith("not participant");
        // Participant honestly presenting his credentials will be rejected
        await expect(
            gatekeeper.contract.methods.sendEther(destinationAddresss, amount, adminPermissions).send({from: adminA})
        ).to.be.revertedWith("not allowed");
    });

    /* Admin replaced - opposite  & Owner loses phone - opposite */
    [
        {address: adminA, title: "admin", permissions: "0x200", expectError: "not allowed"},
        {address: watchdogA, title: "watchdog", permissions: "0x26", expectError: "not allowed"},
        {address: wrongaddr, title: "non-participant", permissions: "0x13f", expectError: "not participant"}
    ].forEach((participant) => {
        it(`should not allow \${${participant.title}} to add or remove admins or watchdogs`, async function () {
            if (![watchdogPermissions, adminPermissions, ownerPermissions].includes(participant.permissions)) {
                assert.fail("Check permissions value"); // this dumb array is apparently created before "before". Ooof.
            }
            await expect(
                callDelayed(gatekeeper.contract.methods.addParticipant, gatekeeper, [participant.address, participant.permissions, adminC, ownerPermissions, level], {from: participant.address}, participant.permissions)
            ).to.be.revertedWith(participant.expectError);

            await expect(
                callDelayed(gatekeeper.contract.methods.removeParticipant, gatekeeper, [participant.address, participant.permissions, utils.participantHash(adminA, "0x270", level)], {from: participant.address}, participant.permissions)
            ).to.be.revertedWith(participant.expectError);

        });
    });

    it("should not allow any operation to be called without a delay");

});