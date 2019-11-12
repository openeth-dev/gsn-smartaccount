const Gatekeeper = artifacts.require("./Gatekeeper.sol");
const Vault = artifacts.require("./Vault.sol");
const Utilities = artifacts.require("./Utilities.sol");
const DAI = artifacts.require("./DAI.sol");
const Chai = require('chai');
const Web3 = require('web3');

const testUtils = require('./utils');
const utils = require('../src/js/old_utils/SafeChannelUtils');
const Permissions = utils.Permissions;
const Participant = require('../src/js/old_utils/Participant');

const expect = Chai.expect;

Chai.use(require('ethereum-waffle').solidity);
Chai.use(require('bn-chai')(web3.utils.toBN));

const minuteInSec = 60;
const hourInSec = 60 * minuteInSec;
const dayInSec = 24 * hourInSec;
const yearInSec = 365 * dayInSec;

async function getDelayedOpHashFromEvent(log, utilities) {
    let actions = log.args.actions;
    let args = log.args.actionsArguments;
    let stateId = log.args.stateId;
    let schedulerAddress = log.args.sender;
    let schedulerPermsLevel = log.args.senderPermsLevel;
    let boosterAddress = log.args.booster;
    let boosterPermsLevel = log.args.boosterPermsLevel;
    return (await utilities.transactionHashPublic(actions, args, stateId, schedulerAddress, schedulerPermsLevel, boosterAddress, boosterPermsLevel));//utils.delayedOpHashNew(actions, args, stateId, schedulerAddress, schedulerPermsLevel, boosterAddress, boosterPermsLevel);
}

const ChangeType = Object.freeze({
    ADD_PARTICIPANT: 0,
    REMOVE_PARTICIPANT: 1,
    CHOWN: 2,
    UNFREEZE: 3
});

async function cancelDelayed({res, log}, fromParticipant, gatekeeper) {
    let {actions, args, schedulerAddress, schedulerPermsLevel, boosterAddress, boosterPermsLevel, scheduledStateId} = extractLog(log, res);
    return gatekeeper.cancelOperation(
        actions,
        args,
        scheduledStateId,
        schedulerAddress,
        schedulerPermsLevel,
        boosterAddress,
        boosterPermsLevel,
        fromParticipant.permLevel,
        {from: fromParticipant.address});
}

function extractLog(log, res) {
    if (log === undefined) {
        log = res.logs[0];
    }
    let actions = log.args.actions;
    let args = log.args.actionsArguments;
    let schedulerAddress = log.args.sender;
    let schedulerPermsLevel = log.args.senderPermsLevel;
    let boosterAddress = log.args.booster;
    let boosterPermsLevel = log.args.boosterPermsLevel;

    let scheduledStateId = log.args.stateId;
    return {actions, args, schedulerAddress, schedulerPermsLevel, boosterAddress, boosterPermsLevel, scheduledStateId};
}

async function applyDelayed({res, log}, fromParticipant, gatekeeper) {
    let {actions, args, schedulerAddress, schedulerPermsLevel, boosterAddress, boosterPermsLevel, scheduledStateId} = extractLog(log, res);

    return gatekeeper.applyConfig(
        actions,
        args,
        scheduledStateId,
        schedulerAddress,
        schedulerPermsLevel,
        boosterAddress,
        boosterPermsLevel,
        fromParticipant.permLevel,
        {from: fromParticipant.address});
}

contract('Gatekeeper', async function (accounts) {

    let gatekeeper;
    let vault;
    let utilities;
    let erc20;
    let fundedAmount = 300;
    let from = accounts[0];
    let level = 1;
    let freezerLevel = 2;
    let highLevel = 3;
    let zeroAddress = "0x0000000000000000000000000000000000000000";
    let ETH_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    let destinationAddress = accounts[2];
    let timeGap = 60 * 60 * 24 * 2 + 10;
    let initialDelays;
    let operatorA;
    let operatorB;
    let wrongaddr;
    let adminA;
    let adminB;
    let adminB1;
    let adminB2;
    let adminC;
    let adminZ;
    let watchdogA;
    let watchdogB;
    let watchdogB1;
    let watchdogC;
    let watchdogZ;
    let amount = 100;
    let startBlock;
    let web3;
    let expectedDelayedEventsCount = 0;
    let ownerPermissions;
    let adminPermissions;
    let watchdogPermissions;

    before(async function () {
        // Merge events so Gatekeeper knows about Vault’s events
        Object.keys(Vault.events).forEach(function (topic) {
            Gatekeeper.network.events[topic] = Vault.events[topic];
        });

        gatekeeper = await Gatekeeper.deployed();
        vault = await Vault.deployed();
        utilities = await Utilities.deployed();
        erc20 = await DAI.new();
        web3 = new Web3(gatekeeper.contract.currentProvider);
        ownerPermissions = utils.bufferToHex(await gatekeeper.ownerPermissions());
        adminPermissions = utils.bufferToHex(await gatekeeper.adminPermissions());
        watchdogPermissions = utils.bufferToHex(await gatekeeper.watchdogPermissions());
        console.log(`ownerPermissions: ${ownerPermissions}`);
        console.log(`adminPermissions: ${adminPermissions}`);
        console.log(`watchdogPermissions: ${watchdogPermissions}}`);
        startBlock = await web3.eth.getBlockNumber();
        initParticipants();
    });

    function initParticipants() {
        operatorA = new Participant(accounts[0], ownerPermissions, level, "operatorA");
        operatorB = new Participant(accounts[11], ownerPermissions, level, "operatorB");
        wrongaddr = new Participant(accounts[1], ownerPermissions, level, "wrongAddress");
        adminA = new Participant(accounts[3], adminPermissions, level, "adminA");
        adminB = new Participant(accounts[4], adminPermissions, level, "adminB");
        adminB1 = new Participant(accounts[5], adminPermissions, highLevel, "adminB1");
        adminB2 = new Participant(accounts[13], adminPermissions, freezerLevel, "adminB2");
        adminC = new Participant(accounts[6], adminPermissions, level, "adminC");
        adminZ = new Participant(accounts[13], adminPermissions, 5, "adminZ");
        watchdogA = new Participant(accounts[7], watchdogPermissions, level, "watchdogA");
        watchdogB = new Participant(accounts[8], watchdogPermissions, freezerLevel, "watchdogB");
        watchdogB1 = new Participant(accounts[9], watchdogPermissions, level, "watchdogB1");
        watchdogC = new Participant(accounts[10], watchdogPermissions, level, "watchdogC");
        watchdogZ = new Participant(accounts[12], watchdogPermissions, 5, "watchdogZ");
    }

    async function getLastEvent(contract, event, expectedCount) {
        let delayedEvents = await contract.getPastEvents(event, {
            fromBlock: startBlock,
            toBlock: 'latest'
        });
        // If 'contract' changes, just make sure to take the right one
        assert.equal(delayedEvents.length, expectedCount);
        return delayedEvents[delayedEvents.length - 1].returnValues;
    }

    it("should not receive the initial configuration with too many participants", async function () {
        let wrongInitialDelays = [];
        let initialParticipants = Array(21).fill("0x1123123");
        await expect(
            gatekeeper.initialConfig(vault.address, initialParticipants, wrongInitialDelays)
        ).to.be.revertedWith("too many participants");
    });

    it("should not receive the initial configuration with too many levels", async function () {
        let wrongInitialDelays = Array(11).fill(10);
        let initialParticipants = [];
        await expect(
            gatekeeper.initialConfig(vault.address, initialParticipants, wrongInitialDelays)
        ).to.be.revertedWith("too many levels");
    });

    it("should not receive the initial configuration with delay too long", async function () {
        let wrongInitialDelays = Array.from({length: 10}, (x, i) => (i + 1) * yearInSec);
        let initialParticipants = [];
        await expect(
            gatekeeper.initialConfig(vault.address, initialParticipants, wrongInitialDelays)
        ).to.be.revertedWith("Delay too long");
    });

    /* Initial configuration */
    it("should receive the initial vault configuration", async function () {
        let operator = await gatekeeper.operator();
        assert.equal(zeroAddress, operator);
        initialDelays = Array.from({length: 10}, (x, i) => (i + 1) * dayInSec);
        let initialParticipants = [
            utils.bufferToHex(utils.participantHash(adminA.address, adminA.permLevel)),
            utils.bufferToHex(utils.participantHash(adminB.address, adminB.permLevel)),
            utils.bufferToHex(utils.participantHash(watchdogA.address, watchdogA.permLevel)),
            utils.bufferToHex(utils.participantHash(watchdogZ.address, watchdogZ.permLevel)),
            utils.bufferToHex(utils.participantHash(adminZ.address, adminZ.permLevel)),
            utils.bufferToHex(utils.participantHash(adminB2.address, adminB2.permLevel)),
        ];

        let res = await gatekeeper.initialConfig(vault.address, initialParticipants, initialDelays);
        let log = res.logs[0];
        assert.equal(log.event, "GatekeeperInitialized");
        assert.equal(log.args.vault, vault.address);

        operator = await gatekeeper.operator();
        assert.equal(operatorA.address, operator);

        // let participants = [operatorA, adminA, adminB, watchdogA, watchdogB, operatorB, adminC, wrongaddr];
        let participants = [
            operatorA.expect(),
            adminA.expect(),
            adminB.expect(),
            watchdogA.expect(),
            adminB2.expect(),
            watchdogB,
            operatorB,
            adminC,
            wrongaddr];
        await utils.validateConfigParticipants(participants, gatekeeper);
        await utils.validateConfigDelays(initialDelays, gatekeeper);
    });

    it("should not receive the initial configuration after configured once", async function () {
        let initialDelays = [];
        let initialParticipants = [];
        await expect(
            gatekeeper.initialConfig(vault.address, initialParticipants, initialDelays)
        ).to.be.revertedWith("already initialized");
    });
    // return;
    /* Positive flows */

    /* Plain send */
    // TODO: this is an integration test (uses 2 contracts)
    // This is better to separate these into a separate file
    it("should allow the owner to create a delayed ether transfer transaction", async function () {
        let stateId = await gatekeeper.stateNonce();
        let res = await gatekeeper.sendEther(destinationAddress, amount, operatorA.permLevel, initialDelays[1], stateId);
        expectedDelayedEventsCount++;
        let log = res.logs[0];
        assert.equal(log.event, "TransactionPending");
        assert.equal(log.address, vault.address);
        assert.equal(log.args.destination, destinationAddress);
        assert.equal(log.args.value, amount);
        assert.equal(log.args.erc20token, ETH_TOKEN_ADDRESS);
        assert.equal(log.args.delay, initialDelays[1]);
        let hash = "0x" + utils.scheduledVaultTxHash(gatekeeper.address, log.args.nonce, log.args.delay, log.args.destination, log.args.value, log.args.erc20token).toString("hex");
        let dueTime = await vault.pending(hash);
        assert.isAbove(dueTime.toNumber(), 0)
    });

    it("just funding the vault", async function () {
        await web3.eth.sendTransaction({from: operatorA.address, to: vault.address, value: amount * 10});
    });

    it("should allow the owner to execute a delayed transfer transaction after delay", async function () {

        let addedLog = await getLastEvent(vault.contract, "TransactionPending", expectedDelayedEventsCount);
        let balanceSenderBefore = parseInt(await web3.eth.getBalance(vault.address));
        let balanceReceiverBefore = parseInt(await web3.eth.getBalance(destinationAddress));
        assert.isAbove(balanceSenderBefore, amount);
        await utils.increaseTime(timeGap, web3);
        let res = await gatekeeper.applyTransfer(addedLog.delay, addedLog.destination, addedLog.value, addedLog.erc20token, addedLog.nonce, operatorA.permLevel, {from: operatorA.address});
        let log = res.logs[0];

        assert.equal(log.event, "TransactionCompleted");
        assert.equal(log.args.destination, destinationAddress);
        assert.equal(log.args.value, amount);

        let balanceSenderAfter = parseInt(await web3.eth.getBalance(vault.address));
        let balanceReceiverAfter = parseInt(await web3.eth.getBalance(destinationAddress));
        assert.equal(balanceSenderAfter, balanceSenderBefore - amount);
        assert.equal(balanceReceiverAfter, balanceReceiverBefore + amount);
    });

    it("funding the vault with ERC20 tokens", async function () {
        await testUtils.fundVaultWithERC20(vault, erc20, fundedAmount, from);
    });

    it("should allow the owner to create a delayed erc20 transfer transaction", async function () {
        let stateId = await gatekeeper.stateNonce();
        let res = await gatekeeper.sendERC20(destinationAddress, amount, operatorA.permLevel, initialDelays[1], erc20.address, stateId);
        expectedDelayedEventsCount++;
        let log = res.logs[0];
        assert.equal(log.event, "TransactionPending");
        assert.equal(log.address, vault.address);
        assert.equal(log.args.destination, destinationAddress);
        assert.equal(log.args.value, amount);
        assert.equal(log.args.erc20token, erc20.address);
        assert.equal(log.args.delay, initialDelays[1]);

        let hash = "0x" + utils.scheduledVaultTxHash(gatekeeper.address, log.args.nonce, log.args.delay, log.args.destination, log.args.value, log.args.erc20token).toString("hex");
        let dueTime = await vault.pending(hash);
        assert.isAbove(dueTime.toNumber(), 0)
    });

    it("should allow the owner to execute a delayed erc20 transfer transaction after delay", async function () {

        let addedLog = await getLastEvent(vault.contract, "TransactionPending", expectedDelayedEventsCount);
        let balanceSenderBefore = (await erc20.balanceOf(vault.address)).toNumber();
        let balanceReceiverBefore = (await erc20.balanceOf(destinationAddress)).toNumber();
        assert.isAbove(balanceSenderBefore, amount);
        await utils.increaseTime(timeGap, web3);

        let res = await gatekeeper.applyTransfer(addedLog.delay, addedLog.destination, addedLog.value, addedLog.erc20token, addedLog.nonce, operatorA.permLevel, {from: operatorA.address});

        let log = res.logs[0];
        assert.equal(log.event, "Transfer");
        assert.equal(log.args.value, amount);
        assert.equal(log.args.from, vault.address);
        assert.equal(log.args.to, addedLog.destination);

        log = res.logs[1];
        assert.equal(log.event, "TransactionCompleted");
        assert.equal(log.args.destination, destinationAddress);
        assert.equal(log.args.value, amount);

        let balanceSenderAfter = (await erc20.balanceOf(vault.address)).toNumber();
        let balanceReceiverAfter = (await erc20.balanceOf(destinationAddress)).toNumber();
        assert.equal(balanceSenderAfter, balanceSenderBefore - amount);
        assert.equal(balanceReceiverAfter, balanceReceiverBefore + amount);
    });

    describe("custom delay tests", async function () {
        let maxDelay = 365 * yearInSec;
        it("should revert delayed ETH transfer due to invalid delay", async function () {
            let stateId = await gatekeeper.stateNonce();
            await expect(
                gatekeeper.sendEther(destinationAddress, amount, operatorA.permLevel, initialDelays[0], stateId)
            ).to.be.revertedWith("Invalid delay given");
            await expect(
                gatekeeper.sendEther(destinationAddress, amount, operatorA.permLevel, maxDelay + 1, stateId)
            ).to.be.revertedWith("Invalid delay given");

        });

        it("should revert delayed ERC20 transfer due to invalid delay", async function () {
            let stateId = await gatekeeper.stateNonce();
            await expect(
                gatekeeper.sendERC20(destinationAddress, amount, operatorA.permLevel, initialDelays[0], erc20.address, stateId)
            ).to.be.revertedWith("Invalid delay given");
            await expect(
                gatekeeper.sendERC20(destinationAddress, amount, operatorA.permLevel, maxDelay + 1, erc20.address, stateId)
            ).to.be.revertedWith("Invalid delay given");

        });
    });


    /* Canceled send, rejected send */

    it("should revert when trying to cancel a transfer transaction that does not exist", async function () {
        await expect(
            gatekeeper.cancelTransfer(watchdogA.permLevel, 0, zeroAddress, 0, zeroAddress, 0, {from: watchdogA.address})
        ).to.be.revertedWith("cannot cancel, operation does not exist");
    });

    it("should allow the owner to create a delayed config transaction", async function () {

        let actions = [ChangeType.ADD_PARTICIPANT];
        let args = [utils.participantHash(adminB1.address, adminB1.permLevel)];
        let stateId = await gatekeeper.stateNonce();
        let res = await gatekeeper.changeConfiguration(actions, args, stateId, operatorA.permLevel);
        let log = res.logs[0];
        assert.equal(log.event, "ConfigPending");
        assert.equal(log.args.sender, operatorA.address);
        assert.equal("0x" + log.args.senderPermsLevel.toString("hex"), operatorA.permLevel);
        assert.deepEqual(log.args.actions.map(it => {
            return it.toNumber()
        }), actions);
        assert.deepEqual(log.args.actionsArguments, args.map(it => {
            return utils.bufferToHex(it)
        }));
    });

    it("should store admins' credentials hashed", async function () {
        let hash = utils.bufferToHex(utils.participantHash(adminA.address, adminA.permLevel));
        let isAdmin = await gatekeeper.participants(hash);
        assert.equal(true, isAdmin);
    });

    /* Rejected config change */
    it("should allow the watchdog to cancel a delayed config transaction", async function () {
        let log = await testUtils.extractLastConfigPendingEvent(gatekeeper);
        let hash = await getDelayedOpHashFromEvent(log, utilities);
        let res2 = await cancelDelayed({log}, watchdogA, gatekeeper);
        let log2 = res2.logs[0];
        assert.equal(log2.event, "ConfigCancelled");
        assert.equal(log2.args.transactionHash, hash);
        assert.equal(log2.args.sender, watchdogA.address);

        await utils.validateConfigParticipants(
            [adminA.expect(), adminB.expect(), adminB1],
            gatekeeper);
    });

    it("should not allow the watchdog to cancel operations scheduled by a higher level participants");

    it("should revert an attempt to delete admin that is not a part of the config", async function () {
        let actions = [ChangeType.REMOVE_PARTICIPANT];
        let args = [utils.participantHash(adminC.address, adminC.permLevel)];
        let stateId = await gatekeeper.stateNonce();
        let res = await gatekeeper.changeConfiguration(actions, args, stateId, operatorA.permLevel);
        let log = res.logs[0];
        assert.equal(log.event, "ConfigPending");
        await utils.increaseTime(timeGap, web3);
        await expect(
            applyDelayed({res}, operatorA, gatekeeper)
        ).to.be.revertedWith("there is no such participant");
    });

    it("should allow the owner to add an admin after a delay", async function () {
        let actions = [ChangeType.ADD_PARTICIPANT];
        let args = [utils.participantHash(adminC.address, adminC.permLevel)];
        let stateId = await gatekeeper.stateNonce();
        let res = await gatekeeper.changeConfiguration(actions, args, stateId, operatorA.permLevel);

        await expect(
            applyDelayed({res}, operatorA, gatekeeper)
        ).to.be.revertedWith("called before due time");
        await utils.increaseTime(timeGap, web3);
        let res2 = await applyDelayed({res}, operatorA, gatekeeper);
        let log2 = res2.logs[0];
        let hash = utils.bufferToHex(utils.participantHash(adminC.address, adminC.permLevel));
        assert.equal(log2.event, "ParticipantAdded");
        assert.equal(log2.args.participant, hash);
        await utils.validateConfigParticipants(
            [adminA.expect(), adminB.expect(), adminB1, adminC.expect()],
            gatekeeper);
    });

    it("should allow the owner to delete an admin after a delay", async function () {
        let actions = [ChangeType.REMOVE_PARTICIPANT];
        let args = [utils.participantHash(adminC.address, adminC.permLevel)];
        let stateId = await gatekeeper.stateNonce();
        let res = await gatekeeper.changeConfiguration(actions, args, stateId, operatorA.permLevel);
        let log = res.logs[0];
        assert.equal(log.event, "ConfigPending");
        await utils.increaseTime(timeGap, web3);
        let res2 = await applyDelayed({res}, operatorA, gatekeeper);
        assert.equal(res2.logs[0].event, "ParticipantRemoved");
        await utils.validateConfigParticipants(
            [adminA.expect(), adminB.expect(), adminB1, adminC],
            gatekeeper);

    });

    /* Admin replaced */
    it("should allow the owner to replace an admin after a delay", async function () {
        let stateId = await gatekeeper.stateNonce();
        let changeType1 = ChangeType.ADD_PARTICIPANT;
        let changeArg1 = utils.participantHash(adminB1.address, adminB1.permLevel);
        let changeType2 = ChangeType.REMOVE_PARTICIPANT;
        let changeArg2 = utils.participantHash(adminB.address, adminB.permLevel);
        await gatekeeper.changeConfiguration([changeType1, changeType2], [changeArg1, changeArg2], stateId, operatorA.permLevel);

        await expect(
            gatekeeper.applyConfig([changeType1, changeType2], [changeArg1, changeArg2], stateId, operatorA.address, operatorA.permLevel, zeroAddress, 0, operatorA.permLevel)
        ).to.be.revertedWith("called before due time");

        await utils.increaseTime(timeGap, web3);

        let res = await gatekeeper.applyConfig([changeType1, changeType2], [changeArg1, changeArg2], stateId, operatorA.address, operatorA.permLevel, zeroAddress, 0, operatorA.permLevel);

        assert.equal(res.logs[0].event, "ParticipantAdded");
        assert.equal(res.logs[1].event, "ParticipantRemoved");

        await utils.validateConfigParticipants(
            [adminA.expect(), adminB, adminB1.expect(), adminC],
            gatekeeper);
    });

    it("should only allow one operator in vault", async function () {
        // as we keep the 'require'-ment to use pre-approved permissions, operator
        // is defined as an account with 'ownerPermissions'
        let actions = [ChangeType.ADD_PARTICIPANT];
        let args = [utils.participantHash(wrongaddr.address, wrongaddr.permLevel)];
        let stateId = await gatekeeper.stateNonce();
        let res1 = await gatekeeper.changeConfiguration(actions, args, stateId, operatorA.permLevel);

        await utils.increaseTime(timeGap, web3);
        await applyDelayed({res: res1}, operatorA, gatekeeper);
        // as per spec file, another 'operator' can be added as a participant, but cannot use it's permissions
        await utils.validateConfigParticipants([wrongaddr.expect()], gatekeeper);

        actions = [ChangeType.ADD_PARTICIPANT];
        args = [utils.participantHash(wrongaddr.address, wrongaddr.permLevel)];
        stateId = await gatekeeper.stateNonce();
        await expect(
            gatekeeper.changeConfiguration(actions, args, stateId, operatorA.permLevel, {from: wrongaddr.address})
        ).to.be.revertedWith("not a real operator");

        // Clean up
        actions = [ChangeType.REMOVE_PARTICIPANT];
        args = [utils.participantHash(wrongaddr.address, wrongaddr.permLevel)];
        stateId = await gatekeeper.stateNonce();
        let res2 = await gatekeeper.changeConfiguration(actions, args, stateId, operatorA.permLevel);
        await utils.increaseTime(timeGap, web3);
        await applyDelayed({res: res2}, operatorA, gatekeeper);
        await utils.validateConfigParticipants([wrongaddr], gatekeeper);
    });

    // TODO: these two tests are identical. Combine into 1 looped test.
    /* Owner loses phone*/
    it("should allow the admin to replace the owner after a delay", async function () {
        let participants = [operatorA.expect(), operatorB];
        await utils.validateConfigParticipants(participants, gatekeeper);
        let stateId = await gatekeeper.stateNonce();
        let res = await gatekeeper.scheduleChangeOwner(adminA.permLevel, operatorB.address, stateId, {from: adminA.address});
        await utils.increaseTime(timeGap, web3);
        await applyDelayed({res}, adminA, gatekeeper);
        participants = [operatorA, operatorB.expect()];
        await utils.validateConfigParticipants(participants, gatekeeper);
    });

    /* There is no scenario where this is described, but this is how it was implemented and now it is documented*/
    it("should allow the owner to replace the owner after a delay", async function () {
        let participants = [operatorA, operatorB.expect()];
        await utils.validateConfigParticipants(participants, gatekeeper);
        let stateId = await gatekeeper.stateNonce();
        let res = await gatekeeper.scheduleChangeOwner(operatorA.permLevel, operatorA.address, stateId, {from: operatorB.address});
        await utils.increaseTime(timeGap, web3);
        await applyDelayed({res}, operatorB, gatekeeper);
        participants = [operatorA.expect(), operatorB];
        await utils.validateConfigParticipants(participants, gatekeeper);
    });

    /* Owner finds the phone after losing it */
    it("should allow the owner to cancel an owner change");

    /* Owner finds the phone after losing it */
    it("should allow the admin to cancel an owner change");

    /* doomsday recover: all participants malicious */
    it("should allow the super-admin to lock out all participants, cancel all operations and replace all participants");

    /* Negative flows */

    /* Owner’s phone controlled by a malicious operator */
    it("should not allow the owner to cancel an owner change if an admin locks him out");

    it(`should allow the cancellers to cancel a delayed transfer transaction`, async function () {
        await utils.asyncForEach(
            [operatorA, watchdogA],
            async (participant) => {
                let stateId = await gatekeeper.stateNonce();
                let res1 = await gatekeeper.sendEther(destinationAddress, amount, operatorA.permLevel, initialDelays[1], stateId);
                expectedDelayedEventsCount++;
                let log1 = res1.logs[0];
                let res2 = await gatekeeper.cancelTransfer(participant.permLevel, log1.args.delay, log1.args.destination, log1.args.value,
                    log1.args.erc20token, log1.args.nonce, {from: participant.address});
                let log2 = res2.logs[0];
                assert.equal(log2.event, "TransactionCancelled");
                assert.equal(log2.address, log1.address);
                assert.equal(log2.args.destination, log1.args.destination);
                assert.equal(log2.args.value.toNumber(), log1.args.value.toNumber());
                assert.equal(log2.args.erc20token, log1.args.erc20token);
                assert.equal(log2.args.nonce.toNumber(), log1.args.nonce.toNumber());
            });
    });

    it(`should allow the cancellers to cancel a delayed ERC20 transfer transaction`, async function () {
        await utils.asyncForEach(
            [operatorA, watchdogA],
            async (participant) => {
                let stateId = await gatekeeper.stateNonce();
                let res1 = await gatekeeper.sendERC20(destinationAddress, amount, operatorA.permLevel, initialDelays[1], erc20.address, stateId);
                expectedDelayedEventsCount++;
                let log1 = res1.logs[0];
                let res2 = await gatekeeper.cancelTransfer(participant.permLevel, log1.args.delay, log1.args.destination, log1.args.value,
                    log1.args.erc20token, log1.args.nonce, {from: participant.address});
                let log2 = res2.logs[0];
                assert.equal(log2.event, "TransactionCancelled");
                assert.equal(log2.address, log1.address);
                assert.equal(log2.args.destination, log1.args.destination);
                assert.equal(log2.args.value.toNumber(), log1.args.value.toNumber());
                assert.equal(log2.args.erc20token, log1.args.erc20token);
                assert.equal(log2.args.nonce.toNumber(), log1.args.nonce.toNumber());
            });
    });

    function getNonSpenders() {
        return [
            adminA.expectError(`permissions missing: ${Permissions.CanSpend}`),
            watchdogA.expectError(`permissions missing: ${Permissions.CanSpend}`),
            wrongaddr.expectError("not participant")
        ];
    }

    function getNonChowners() {
        return [
            watchdogA.expectError(`permissions missing: ${Permissions.CanChangeOwner}`),
            wrongaddr.expectError("not participant")
        ];
    }

    function getNonConfigChangers() {
        return [
            adminA.expectError(`permissions missing: ${Permissions.CanChangeParticipants + Permissions.CanUnfreeze}`),
            watchdogA.expectError(`permissions missing: ${Permissions.CanChangeConfig}`),
            wrongaddr.expectError("not participant")
        ];
    }

    function getNonBoostees() {
        return [
            adminA.expectError(`permissions missing: ${Permissions.CanSignBoosts + Permissions.CanUnfreeze + Permissions.CanChangeParticipants}`),
            watchdogA.expectError(`permissions missing: ${Permissions.CanSignBoosts + Permissions.CanChangeConfig}`),
            wrongaddr.expectError("not participant")
        ];
    }

    it(`should not allow non-chowners to change owner`, async function () {
        let stateId = await gatekeeper.stateNonce();
        await utils.asyncForEach(getNonChowners(), async (participant) => {
            await expect(
                gatekeeper.scheduleChangeOwner(participant.permLevel, adminC.address, stateId, {from: participant.address})
            ).to.be.revertedWith(participant.expectError);
            console.log(`${participant.name} + scheduleChangeOwner + ${participant.expectError}`)
        });
    });

    /* Admin replaced - opposite  & Owner loses phone - opposite */
    it(`should not allow non-config-changers to add or remove admins or watchdogs`, async function () {
        let stateId = await gatekeeper.stateNonce();
        await utils.asyncForEach(getNonConfigChangers(), async (participant) => {
            let actions = [ChangeType.ADD_PARTICIPANT];
            let args = [utils.participantHash(adminC.address, adminC.permLevel)];
            await expect(
                gatekeeper.changeConfiguration(actions, args, stateId, participant.permLevel, {from: participant.address})
            ).to.be.revertedWith(participant.expectError);
            console.log(`${participant.name} + addParticipant + ${participant.expectError}`);

            actions = [ChangeType.REMOVE_PARTICIPANT];
            args = [utils.participantHash(adminA.address, adminA.permLevel)];
            await expect(
                gatekeeper.changeConfiguration(actions, args, stateId, participant.permLevel, {from: participant.address})
            ).to.be.revertedWith(participant.expectError);
            console.log(`${participant.name} + removeParticipant + ${participant.expectError}`)

        });
    });

    it(`should not allow non-spenders to create a delayed transfer transaction`, async function () {
        let stateId = await gatekeeper.stateNonce();
        await utils.asyncForEach(getNonSpenders(), async (participant) => {
            await expect(
                gatekeeper.sendEther(destinationAddress, amount, participant.permLevel, initialDelays[1], stateId, {from: participant.address})
            ).to.be.revertedWith(participant.expectError);
            console.log(`${participant.name} + sendEther + ${participant.expectError}`)

        });
    });

    it(`should not allow non-spenders to create a delayed ERC20 transfer transaction`, async function () {
        let stateId = await gatekeeper.stateNonce();
        await utils.asyncForEach(getNonSpenders(), async (participant) => {
            await expect(
                gatekeeper.sendERC20(destinationAddress, amount, participant.permLevel, initialDelays[1], erc20.address, stateId, {from: participant.address})
            ).to.be.revertedWith(participant.expectError);
            console.log(`${participant.name} + sendERC20 + ${participant.expectError}`)

        });
    });

    it.skip("should not allow \${${participant.title}} to freeze", async function () {

    });

    it("should not allow to freeze level that is higher than the caller's");
    it("should not allow to freeze for zero time");
    it("should not allow to freeze for enormously long time");

    // TODO: separate into 'isFrozen' check and a separate tests for each disabled action while frozen
    it("should allow the watchdog to freeze all participants below its level", async function () {
        let stateId = await gatekeeper.stateNonce();
        let res0;
        {
            let actions = [ChangeType.ADD_PARTICIPANT];
            let args = [utils.participantHash(watchdogB.address, watchdogB.permLevel)];
            res0 = await gatekeeper.changeConfiguration(actions, args, stateId, operatorA.permLevel);
            await utils.increaseTime(timeGap, web3);
            await applyDelayed({res: res0}, operatorA, gatekeeper);
        }

        await utils.validateConfigParticipants([
            operatorA.expect(),
            watchdogA.expect(),
            watchdogB.expect(),
            adminA.expect(),
            adminB1.expect()
        ], gatekeeper);

        // set interval longer then delay, so that increase time doesn't unfreeze the vault
        let interval = timeGap * 2;
        let res = await gatekeeper.freeze(watchdogB.permLevel, level, interval, {from: watchdogB.address});
        let block = await web3.eth.getBlock(res.receipt.blockNumber);
        let log = res.logs[0];
        assert.equal(log.event, "LevelFrozen");
        assert.equal(log.args.frozenLevel, level);
        assert.equal(log.args.frozenUntil.toNumber(), block.timestamp + interval);
        assert.equal(log.args.sender, watchdogB.address);

        // Operator cannot send money any more
        let reason = "level is frozen";
        stateId = await gatekeeper.stateNonce();
        await expect(
            gatekeeper.sendEther(destinationAddress, amount, operatorA.permLevel, initialDelays[1], stateId, {from: operatorA.address})
        ).to.be.revertedWith(reason);

        await expect(
            gatekeeper.sendERC20(destinationAddress, amount, operatorA.permLevel, initialDelays[1], erc20.address, stateId, {from: operatorA.address})
        ).to.be.revertedWith(reason);

        // On lower levels:
        // Operator cannot change configuration any more
        let actions = [ChangeType.ADD_PARTICIPANT];
        let args = [utils.participantHash(adminC.address, adminC.permLevel)];
        await expect(
            gatekeeper.changeConfiguration(actions, args, stateId, operatorA.permLevel),
            "addParticipant did not revert correctly"
            + ` with expected reason: "${reason}"`
        ).to.be.revertedWith(reason);

        // Admin cannot change owner any more
        await expect(
            gatekeeper.scheduleChangeOwner(adminA.permLevel, adminC.address, stateId, {from: adminA.address}),
            "scheduleChangeOwner did not revert correctly"
            + ` with expected reason: "${reason}"`
        ).to.be.revertedWith(reason);

        // Watchdog cannot cancel operations any more
        await expect(
            cancelDelayed({res: res0}, watchdogA, gatekeeper),
            "cancelOperation did not revert correctly"
            + ` with expected reason: "${reason}"`
        ).to.be.revertedWith(reason);

        await expect(
            gatekeeper.cancelTransfer(watchdogA.permLevel, 0, zeroAddress, 0, zeroAddress, 0, {from: watchdogA.address}),
            "cancelTransfer did not revert correctly"
            + ` with expected reason: "${reason}"`
        ).to.be.revertedWith(reason);

        // On the level of the freezer or up:
        // Admin can still call 'change owner'
        let res2 = await gatekeeper.scheduleChangeOwner(adminB2.permLevel, operatorB.address, stateId, {from: adminB2.address});

        // Watchdog can still cancel stuff
        let res3 = await cancelDelayed({res: res2}, watchdogB, gatekeeper);
        assert.equal(res3.logs[0].event, "ConfigCancelled");
    });

    it("should not allow to shorten the length of a freeze");
    it("should not allow to lower the level of the freeze");

    it("should not allow non-boosters to unfreeze", async function () {

        await utils.asyncForEach(getNonBoostees(), async (signingParty) => {

            let actions = [ChangeType.UNFREEZE];
            let args = ["0x0"];
            let stateId = await gatekeeper.stateNonce();
            let encodedHash = await utilities.changeHash(actions, args, stateId);//utils.getTransactionHash(ABI.solidityPack(["uint8[]", "bytes32[]", "uint256"], [actions, args, stateId]));
            let signature = await utils.signMessage(encodedHash, web3, {from: signingParty.address});
            await expect(
                gatekeeper.boostedConfigChange(
                    actions,
                    args,
                    stateId,
                    adminB1.permLevel,
                    signingParty.permLevel,
                    signature,
                    {from: adminB1.address})
            ).to.be.revertedWith(signingParty.expectError);

            console.log(`${signingParty.name} + boostedConfigChange + ${signingParty.expectError}`)
        });
    });

    it("should allow owner and admin together to unfreeze", async function () {
        // Meke sure vault is still frozen
        let frozenLevel = await gatekeeper.frozenLevel();
        let frozenUntil = parseInt(await gatekeeper.frozenUntil()) * 1000;
        assert.equal(frozenLevel, operatorA.level);
        let oneHourMillis = 60 * 60 * 1000;
        assert.isAtLeast(frozenUntil, Date.now() + oneHourMillis);

        // Schedule a boosted unfreeze by a high level admin
        let actions = [ChangeType.UNFREEZE];
        let args = ["0x0"];
        let stateId = await gatekeeper.stateNonce();
        let encodedHash = await utilities.changeHash(actions, args, stateId);//utils.getTransactionHash(ABI.solidityPack(["uint8[]", "bytes32[]", "uint256"], [actions, args, stateId]));
        let signature = await utils.signMessage(encodedHash, web3, {from: operatorA.address});
        let res1 = await gatekeeper.boostedConfigChange(actions, args, stateId, adminB1.permLevel, operatorA.permLevel, signature, {from: adminB1.address});
        let log1 = res1.logs[0];

        assert.equal(log1.event, "ConfigPending");

        // Execute the scheduled unfreeze
        await utils.increaseTime(timeGap, web3);

        // Operator still cannot send money, not time-caused unfreeze
        await expect(
            gatekeeper.sendEther(destinationAddress, amount, operatorA.permLevel, initialDelays[1], stateId, {from: operatorA.address})
        ).to.be.revertedWith("level is frozen");
        await expect(
            gatekeeper.sendERC20(destinationAddress, amount, operatorA.permLevel, initialDelays[1], erc20.address, stateId, {from: operatorA.address})
        ).to.be.revertedWith("level is frozen");
        let res3 = await applyDelayed({log: log1}, adminB1, gatekeeper);
        let log3 = res3.logs[0];

        assert.equal(log3.event, "UnfreezeCompleted");

        stateId = await gatekeeper.stateNonce();
        let res2 = await gatekeeper.sendEther(destinationAddress, amount, operatorA.permLevel, initialDelays[1], stateId);
        let log2 = res2.logs[0];
        assert.equal(log2.event, "TransactionPending");
        assert.equal(log2.address, vault.address);

        stateId = await gatekeeper.stateNonce();
        let res4 = await gatekeeper.sendERC20(destinationAddress, amount, operatorA.permLevel, initialDelays[1], erc20.address, stateId);
        let log4 = res4.logs[0];
        assert.equal(log4.event, "TransactionPending");
        assert.equal(log4.address, vault.address);

    });

    describe("when schedule happens before freeze", function () {

        it("should not allow to apply an already scheduled Delayed Op if the scheduler's rank is frozen", async function () {
            // Schedule a totally valid config change
            let actions = [ChangeType.ADD_PARTICIPANT];
            let args = [utils.participantHash(adminB1.address, adminB1.permLevel)];
            let stateId = await gatekeeper.stateNonce();
            let res1 = await gatekeeper.changeConfiguration(actions, args, stateId, operatorA.permLevel);

            // Freeze the scheduler's rank
            await gatekeeper.freeze(watchdogB.permLevel, level, timeGap, {from: watchdogB.address});

            // Sender cannot apply anything - he is frozen
            await expect(
                applyDelayed({res: res1}, operatorA, gatekeeper)
            ).to.be.revertedWith("level is frozen");

            // Somebody who can apply cannot apply either
            await expect(
                applyDelayed({res: res1}, adminB1, gatekeeper)
            ).to.be.revertedWith("scheduler level is frozen");
        });

        // TODO: actually call unfreeze, as the state is different. Actually, this is a bit of a problem. (extra state: outdated freeze). Is there a way to fix it?
        it("should not allow to apply an already scheduled boosted Delayed Op if the booster's rank is also frozen", async function () {
            // Schedule a boosted unfreeze by a high level admin

            let actions = [ChangeType.UNFREEZE];
            let args = ["0x0"];
            let stateId = await gatekeeper.stateNonce();
            let encodedHash = await utilities.changeHash(actions, args, stateId);//utils.getTransactionHash(ABI.solidityPack(["uint8[]", "bytes32[]", "uint256"], [actions, args, stateId]));
            let signature = await utils.signMessage(encodedHash, web3, {from: operatorA.address});
            let res1 = await gatekeeper.boostedConfigChange(
                actions,
                args,
                stateId,
                adminB1.permLevel,
                operatorA.permLevel,
                signature,
                {from: adminB1.address});
            let log1 = res1.logs[0];
            assert.equal(log1.event, "ConfigPending");


            // Increase freeze level to one above the old booster level
            await gatekeeper.freeze(watchdogZ.permLevel, highLevel, timeGap, {from: watchdogZ.address});

            // Admin with level 5 tries to apply the boosted operation
            await expect(
                applyDelayed({res: res1}, adminZ, gatekeeper)
            ).to.be.revertedWith("booster level is frozen");

        });
    });

    it("should automatically unfreeze after a time interval");

    it("should revert an attempt to unfreeze if vault is not frozen");

    it("should validate correctness of claimed senderPermissions");
    it("should validate correctness of claimed sender address");
    it("should not allow any operation to be called without a delay");
    it("should only allow delayed calls to whitelisted operations");

    it("should revert an attempt to apply an operation under some other participant's name", async function () {
        // Schedule config change by operator, and claim to be an admin when applying
        let stateId = await gatekeeper.stateNonce();
        let changeType = ChangeType.ADD_PARTICIPANT;
        let changeArgs = utils.participantHash(adminB1.address, adminB1.permLevel);

        await gatekeeper.changeConfiguration([changeType], [changeArgs], stateId, operatorA.permLevel);

        await utils.increaseTime(timeGap, web3);
        // adminA cannot apply it - will not find it by hash
        await expect(
            gatekeeper.applyConfig([changeType], [changeArgs], stateId, adminA.address, adminA.permLevel, zeroAddress, 0, adminA.permLevel, {from: adminA.address})
        ).to.be.revertedWith("apply called for non existent pending change");

    });

    it("should revert an attempt to apply a boosted operation under some other participant's name");

    it("should revert an attempt to apply a boosted operation claiming wrong permissions");
    it("should revert an attempt to apply an operation claiming wrong permissions");


    it("should revert an attempt to schedule a transaction if the target state nonce is incorrect", async function () {
        let stateId = await gatekeeper.stateNonce();
        let changeType = ChangeType.ADD_PARTICIPANT;
        let changeArgs = utils.participantHash(adminB1.address, adminB1.permLevel);

        await expect(gatekeeper.changeConfiguration([changeType], [changeArgs], stateId - 1, operatorA.permLevel)
        ).to.be.revertedWith("contract state changed since transaction was created")
    });

    it("should save the block number of the deployment transaction", async function () {
        // not much to check here - can't know the block number
        let deployedBlock = (await gatekeeper.deployedBlock()).toNumber();
        assert.isAbove(deployedBlock, 0);
    });

    after("write coverage report", async () => {
        await global.postCoverage()
    });
});