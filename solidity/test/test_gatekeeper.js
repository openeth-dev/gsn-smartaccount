const Gatekeeper = artifacts.require("./Gatekeeper.sol");
const Vault = artifacts.require("./Vault.sol");
const Chai = require('chai');
const Web3 = require('web3');
const ABI = require('ethereumjs-abi');
const EthereumjsUtil = require('ethereumjs-util');

const testUtils = require('./utils');
const utils = require('../src/js/SafeChannelUtils');
const Participant = require('../src/js/Participant');

const expect = Chai.expect;

Chai.use(require('ethereum-waffle').solidity);
Chai.use(require('bn-chai')(web3.utils.toBN));

function getDelayedOpHashFromEvent(log) {
    let batchMetadata = log.args.batchMetadata;
    let batchMetadataBuff = Buffer.from(batchMetadata.slice(2), "hex");
    let opsNonce = log.args.opsNonce.toNumber();
    let encoded = log.args.operation;
    let encodedBuff = Buffer.from(encoded.slice(2), "hex");
    return utils.delayedOpHash(batchMetadataBuff, opsNonce, encodedBuff);
}

async function callDelayed(method, gatekeeper, callArguments, from) {
    // TODO: remove the first two parameters (scheduler, schedulerPermissions) if there will not arise a use case.
    assert.equal(true, (typeof callArguments[0]) === 'string' && EthereumjsUtil.isHexPrefixed(callArguments[0]));
    // TODO: parseint the permissions thing and compare to 0xffff !!!
    assert.equal(true, callArguments[1].length > 0 && callArguments[1].length < 6 && EthereumjsUtil.isHexPrefixed(callArguments[1]));

    let encodedABI = method(...callArguments).encodeABI();
    let encodedPacked = utils.encodePackedBatch([encodedABI]);
    return await gatekeeper.changeConfiguration(callArguments[1], encodedPacked, {from: from});
}

async function applyDelayed({res, log}, sender, gatekeeper, booster, scheduler, ignoreObviousError) {
    if (log === undefined) {
        log = res.logs[0];
    }
    let boosterAddress;
    let boosterPermsLevel;
    if (booster === undefined) {
        boosterAddress = "0x0000000000000000000000000000000000000000";
        boosterPermsLevel = "0";
    } else {
        boosterAddress = booster.address;
        boosterPermsLevel = booster.permLevel;
    }
    let schedulerAddress;
    let schedulerPermsLevel;
    // TODO!! Events should emit this data!
    if (scheduler === undefined) {
        scheduler = sender;
        schedulerAddress = sender.address;
        schedulerPermsLevel = sender.permLevel;

    } else {
        schedulerAddress = scheduler.address;
        schedulerPermsLevel = scheduler.permLevel;
    }

    let batchOperation = log.args.operation;

    let senderPermsLevel = sender.permLevel;
    let nonce = log.args.opsNonce.toString();
    let expectedMetadata = getExpectedMetadata(scheduler, booster);
    if (!ignoreObviousError) {
        assert.equal(expectedMetadata, log.args.batchMetadata, "This will lead to a revert, right?");
    }
    return gatekeeper.applyBatch(
        schedulerAddress,
        schedulerPermsLevel,
        boosterAddress,
        boosterPermsLevel,
        batchOperation,
        senderPermsLevel,
        nonce,
        {from: sender.address});
}

function getExpectedMetadata(sender, booster) {
    if (booster === undefined) {
        booster = {
            address: "0x0",
            permLevel: "0x0",
        }
    }
    return "0x" + ABI.rawEncode(
        ["address", "uint16", "address", "uint16"],
        [sender.address, sender.permLevel, booster.address, booster.permLevel]
    ).toString("hex");
}

contract('Gatekeeper', async function (accounts) {

    let gatekeeper;
    let vault;
    let level = 1;
    let freezerLevel = 2;
    let highLevel = 3;
    let zeroAddress = "0x0000000000000000000000000000000000000000";
    let destinationAddresss = accounts[2];
    let timeGap = 3600 * 24 * 2 + 10;
    let operatorA;
    let operatorB;
    let wrongaddr;
    let adminA;
    let adminB;
    let adminB1;
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

    let addParticipant;
    let removeParticipant;
    let changeOwner;

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
        addParticipant = gatekeeper.contract.methods.addParticipant;
        removeParticipant = gatekeeper.contract.methods.removeParticipant;
        changeOwner = gatekeeper.contract.methods.changeOwner;
        initParticipants();
    });

    function initParticipants() {
        operatorA = new Participant(accounts[0], ownerPermissions, level, "operatorA");
        operatorB = new Participant(accounts[11], ownerPermissions, level, "operatorB");
        wrongaddr = new Participant(accounts[1], ownerPermissions, level, "wrongAddress");
        adminA = new Participant(accounts[3], adminPermissions, level, "adminA");
        adminB = new Participant(accounts[4], adminPermissions, level, "adminB");
        adminB1 = new Participant(accounts[5], adminPermissions, highLevel, "adminB1");
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
        let initialDelays = [];
        let initialParticipants = Array(21).fill("0x1123123");
        await expect(
            gatekeeper.initialConfig(vault.address, initialParticipants, initialDelays)
        ).to.be.revertedWith("too many participants");
    });

    it("should not receive the initial configuration with too many levels", async function () {
        let initialDelays = Array(11).fill(10);
        let initialParticipants = [];
        await expect(
            gatekeeper.initialConfig(vault.address, initialParticipants, initialDelays)
        ).to.be.revertedWith("too many levels");
    });

    /* Initial configuration */
    it("should receive the initial vault configuration", async function () {
        let operator = await gatekeeper.operator();
        assert.equal(zeroAddress, operator);
        let initialDelays = [10, 10, 10]; // TODO: support delays
        let initialParticipants = [
            utils.bufferToHex(utils.participantHash(adminA.address, adminA.permLevel)),
            utils.bufferToHex(utils.participantHash(adminB.address, adminB.permLevel)),
            utils.bufferToHex(utils.participantHash(watchdogA.address, watchdogA.permLevel)),
            utils.bufferToHex(utils.participantHash(watchdogZ.address, watchdogZ.permLevel)),
            utils.bufferToHex(utils.participantHash(adminZ.address, adminZ.permLevel)),
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
            watchdogB,
            operatorB,
            adminC,
            wrongaddr];
        await utils.validateConfig(participants, gatekeeper);
    });

    it("should not receive the initial configuration after configured once", async function () {
        let initialDelays = []; // TODO: support delays
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
        let res = await gatekeeper.sendEther(destinationAddresss, amount, operatorA.permLevel);
        expectedDelayedEventsCount++;
        let log = res.logs[0];
        assert.equal(log.event, "DelayedOperation");
        assert.equal(log.address, vault.address);
        // Vault sees the transaction as originating from Gatekeeper
        // and it does not know or care which participant initiated it
        let nonceInExtraData = "0x0";
        let expectedMetadata = "0x" + ABI.rawEncode(["address", "bytes32"], [gatekeeper.address, nonceInExtraData]).toString("hex");
        assert.equal(log.args.batchMetadata, expectedMetadata);
        // TODO: go through gatekeeper::applyTransfer
        let encodedABI = vault.contract.methods.transferETH(gatekeeper.address, nonceInExtraData, destinationAddresss, amount).encodeABI();
        let encodedPacked = utils.bufferToHex(utils.encodePackedBatch([encodedABI]));
        assert.equal(log.args.operation, encodedPacked);
    });

    it("just funding the vault", async function () {
        await web3.eth.sendTransaction({from: operatorA.address, to: vault.address, value: amount * 10});
    });

    it("should allow the owner to execute a delayed transfer transaction after delay", async function () {

        let addedLog = await getLastEvent(vault.contract, "DelayedOperation", expectedDelayedEventsCount);
        let balanceSenderBefore = parseInt(await web3.eth.getBalance(vault.address));
        let balanceRecieverBefore = parseInt(await web3.eth.getBalance(destinationAddresss));
        assert.isAbove(balanceSenderBefore, amount);
        await utils.increaseTime(timeGap, web3);

        let res = await gatekeeper.applyTransfer(addedLog.operation, addedLog.opsNonce, operatorA.permLevel, {from: operatorA.address});
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
            gatekeeper.cancelTransfer(watchdogA.permLevel, "0x123123", {from: watchdogA.address})
        ).to.be.revertedWith("cannot cancel, operation does not exist");
    });

    it("should allow the owner to create a delayed config transaction", async function () {
        let encodedABI = gatekeeper.contract.methods.addParticipant(operatorA.address, operatorA.permLevel, adminB1.address, adminB1.permLevel).encodeABI();
        let encodedPacked = utils.encodePackedBatch([encodedABI]);

        let callArguments = [operatorA.address, operatorA.permLevel, adminB1.address, adminB1.permLevel];
        let res = await callDelayed(addParticipant, gatekeeper, callArguments, operatorA.address);
        let log = res.logs[0];
        let expectedMetadata = getExpectedMetadata(operatorA);
        assert.equal(log.event, "DelayedOperation");
        assert.equal(log.address, gatekeeper.address);
        assert.equal(log.args.batchMetadata, expectedMetadata);
        assert.equal(log.args.operation, utils.bufferToHex(encodedPacked));
    });

    it("should store admins' credentials hashed", async function () {
        let hash = utils.bufferToHex(utils.participantHash(adminA.address, adminA.permLevel));
        let isAdmin = await gatekeeper.participants(hash);
        assert.equal(true, isAdmin);
    });

    /* Rejected config change */
    it("should allow the watchdog to cancel a delayed config transaction", async function () {
        let log = await testUtils.extractLastDelayedOpsEvent(gatekeeper);
        let hash = getDelayedOpHashFromEvent(log);
        let res2 = await gatekeeper.cancelOperation(watchdogA.permLevel, hash, {from: watchdogA.address});
        let log2 = res2.logs[0];
        assert.equal(log2.event, "DelayedOperationCancelled");
        assert.equal(log2.address, gatekeeper.address);
        assert.equal(log2.args.hash, "0x" + hash.toString("hex"));
        assert.equal(log2.args.sender, watchdogA.address);

        await utils.validateConfig(
            [adminA.expect(), adminB.expect(), adminB1],
            gatekeeper);
    });

    it("should revert an attempt to delete admin that is not a part of the config", async function () {
        let callArguments = [operatorA.address, operatorA.permLevel, utils.participantHash(adminC.address, adminC.permLevel)];
        let res = await callDelayed(removeParticipant, gatekeeper, callArguments, operatorA.address);
        let log = res.logs[0];
        assert.equal(log.event, "DelayedOperation");
        await utils.increaseTime(timeGap, web3);
        await expect(
            applyDelayed({res}, operatorA, gatekeeper)
        ).to.be.revertedWith("there is no such participant");
    });

    it("should allow the owner to add an admin after a delay", async function () {
        let callArguments = [operatorA.address, operatorA.permLevel, adminC.address, adminC.permLevel];
        let res = await callDelayed(addParticipant, gatekeeper, callArguments, operatorA.address);
        await expect(
            applyDelayed({res}, operatorA, gatekeeper)
        ).to.be.revertedWith("called before due time");
        await utils.increaseTime(timeGap, web3);
        let res2 = await applyDelayed({res}, operatorA, gatekeeper);
        let log2 = res2.logs[0];
        let hash = utils.bufferToHex(utils.participantHash(adminC.address, adminC.permLevel));
        assert.equal(log2.event, "ParticipantAdded");
        assert.equal(log2.args.participant, hash);
        await utils.validateConfig(
            [adminA.expect(), adminB.expect(), adminB1, adminC.expect()],
            gatekeeper);
    });

    it("should allow the owner to delete an admin after a delay", async function () {
        let callArguments = [operatorA.address, operatorA.permLevel, utils.participantHash(adminC.address, adminC.permLevel)];
        let res = await callDelayed(removeParticipant, gatekeeper, callArguments, operatorA.address);
        let log = res.logs[0];
        assert.equal(log.event, "DelayedOperation");
        await utils.increaseTime(timeGap, web3);
        let res2 = await applyDelayed({res}, operatorA, gatekeeper);
        assert.equal(res2.logs[0].event, "ParticipantRemoved");
        await utils.validateConfig(
            [adminA.expect(), adminB.expect(), adminB1, adminC],
            gatekeeper);

    });

    /* Admin replaced */
    it("should allow the owner to replace an admin after a delay", async function () {
        let encodedABI_add_adminB1 = gatekeeper.contract.methods.addParticipant(operatorA.address, operatorA.permLevel, adminB1.address, adminB1.permLevel).encodeABI();
        let encodedABI_remove_adminB = gatekeeper.contract.methods.removeParticipant(operatorA.address, operatorA.permLevel, utils.participantHash(adminB.address, adminB.permLevel)).encodeABI();
        let encodedPacked = utils.encodePackedBatch([encodedABI_add_adminB1, encodedABI_remove_adminB]);
        let res = await gatekeeper.changeConfiguration(operatorA.permLevel, encodedPacked);

        await expect(
            applyDelayed({res}, operatorA, gatekeeper)
        ).to.be.revertedWith("called before due time");

        await utils.increaseTime(timeGap, web3);

        let res2 = await applyDelayed({res}, operatorA, gatekeeper);

        assert.equal(res2.logs[0].event, "ParticipantAdded");
        assert.equal(res2.logs[1].event, "ParticipantRemoved");

        await utils.validateConfig(
            [adminA.expect(), adminB, adminB1.expect(), adminC],
            gatekeeper);
    });

    it("should only allow one operator in vault", async function () {
        // as we keep the 'require'-ment to use pre-approved permissions, operator
        // is defined as an account with 'ownerPermissions'
        let callArguments = [operatorA.address, operatorA.permLevel, wrongaddr.address, wrongaddr.permLevel];
        let res1 = await callDelayed(addParticipant, gatekeeper, callArguments, operatorA.address);
        await utils.increaseTime(timeGap, web3);
        await applyDelayed({res: res1}, operatorA, gatekeeper);
        // as per spec file, another 'operator' can be added as a participant, but cannot use it's permissions
        await utils.validateConfig([wrongaddr.expect()], gatekeeper);

        let anyCallArguments = [wrongaddr.address, operatorA.permLevel, wrongaddr.address, wrongaddr.permLevel];
        await expect(
            callDelayed(addParticipant, gatekeeper, anyCallArguments, wrongaddr.address)
        ).to.be.revertedWith("not a real operator");

        // Clean up
        let callArgumentsCleanUp = [operatorA.address, operatorA.permLevel, utils.participantHash(wrongaddr.address, wrongaddr.permLevel)];
        let res2 = await callDelayed(removeParticipant, gatekeeper, callArgumentsCleanUp, operatorA.address);
        await utils.increaseTime(timeGap, web3);
        await applyDelayed({res: res2}, operatorA, gatekeeper);
        await utils.validateConfig([wrongaddr], gatekeeper);
    });

    // TODO: these two tests are identical. Combine into 1 looped test.
    /* Owner loses phone*/
    it("should allow the admin to replace the owner after a delay", async function () {
        let participants = [operatorA.expect(), operatorB];
        await utils.validateConfig(participants, gatekeeper);
        let res = await gatekeeper.scheduleChangeOwner(adminA.permLevel, operatorB.address, {from: adminA.address});
        await utils.increaseTime(timeGap, web3);
        await applyDelayed({res}, adminA, gatekeeper);
        participants = [operatorA, operatorB.expect()];
        await utils.validateConfig(participants, gatekeeper);
    });

    /* There is no scenario where this is described, but this is how it was implemented and now it is documented*/
    it("should allow the owner to replace the owner after a delay", async function () {
        let participants = [operatorA, operatorB.expect()];
        await utils.validateConfig(participants, gatekeeper);
        let res = await gatekeeper.scheduleChangeOwner(operatorA.permLevel, operatorA.address, {from: operatorB.address});
        await utils.increaseTime(timeGap, web3);
        await applyDelayed({res}, operatorB, gatekeeper);
        participants = [operatorA.expect(), operatorB];
        await utils.validateConfig(participants, gatekeeper);
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
                let res1 = await gatekeeper.sendEther(destinationAddresss, amount, operatorA.permLevel);
                expectedDelayedEventsCount++;
                let hash = getDelayedOpHashFromEvent(res1.logs[0]);
                let res2 = await gatekeeper.cancelTransfer(participant.permLevel, hash, {from: participant.address});
                let log = res2.logs[0];
                assert.equal(log.event, "DelayedOperationCancelled");
                assert.equal(log.address, vault.address);
                assert.equal(log.args.hash, "0x" + hash.toString("hex"));
                assert.equal(log.args.sender, gatekeeper.address);
            });
    });

    function getNonSpenders() {
        return getNonConfigChangers();
    }

    function getNonChowners() {
        return [
            watchdogA.expectError("not allowed"),
            wrongaddr.expectError("not participant")
        ];
    }

    function getNonConfigChangers() {
        return [
            adminA.expectError("not allowed"),
            watchdogA.expectError("not allowed"),
            wrongaddr.expectError("not participant")
        ];
    }

    function getNonBoosters() {
        return [
            adminA.expectError("boost not allowed"),
            watchdogA.expectError("boost not allowed"),
            wrongaddr.expectError("not participant")
        ];
    }

    it(`should not allow non-chowners to change owner`, async function () {
        await utils.asyncForEach(getNonChowners(), async (participant) => {
            await expect(
                gatekeeper.scheduleChangeOwner(participant.permLevel, adminC.address, {from: participant.address})
            ).to.be.revertedWith(participant.expectError);
            console.log(`${participant.name} + scheduleChangeOwner + ${participant.expectError}`)
        });
    });

    /* Admin replaced - opposite  & Owner loses phone - opposite */
    it(`should not allow non-config-changers to add or remove admins or watchdogs`, async function () {
        await utils.asyncForEach(getNonConfigChangers(), async (participant) => {
            let callArgumentsAdd = [participant.address, participant.permLevel, adminC.address, adminC.permLevel];
            await expect(
                callDelayed(addParticipant, gatekeeper, callArgumentsAdd, participant.address)
            ).to.be.revertedWith(participant.expectError);
            console.log(`${participant.name} + addParticipant + ${participant.expectError}`)

            let callArgumentsRemove = [participant.address, participant.permLevel, utils.participantHash(adminA.address, adminA.permLevel)];
            await expect(
                callDelayed(removeParticipant, gatekeeper, callArgumentsRemove, participant.address)
            ).to.be.revertedWith(participant.expectError);
            console.log(`${participant.name} + removeParticipant + ${participant.expectError}`)

        });
    });

    it(`should not allow non-spenders to create a delayed transfer transaction`, async function () {
        await utils.asyncForEach(getNonSpenders(), async (participant) => {
            await expect(
                gatekeeper.sendEther(destinationAddresss, amount, participant.permLevel, {from: participant.address})
            ).to.be.revertedWith(participant.expectError);
            console.log(`${participant.name} + destinationAddresss + ${participant.expectError}`)

        });
    });

    it.skip("should not allow \${${participant.title}} to freeze", async function () {

    });

    it("should not allow to freeze level that is higher than the caller's");
    it("should not allow to freeze for zero time");
    it("should not allow to freeze for enormously long time");

    // TODO: separate into 'isFrozen' check and a separate tests for each disabled action while frozen
    it("should allow the watchdog to freeze all participants below it's level", async function () {
        {
            let callArguments = [operatorA.address, operatorA.permLevel, watchdogB.address, watchdogB.permLevel];
            let res0 = await callDelayed(addParticipant, gatekeeper, callArguments, operatorA.address);
            await utils.increaseTime(timeGap, web3);
            await applyDelayed({res: res0}, operatorA, gatekeeper);
        }

        await utils.validateConfig([
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
        await expect(
            gatekeeper.sendEther(destinationAddresss, amount, operatorA.permLevel, {from: operatorA.address})
        ).to.be.revertedWith(reason);

        // On lower levels:
        // Operator cannot change configuration any more
        let callArgumentsAdd = [operatorA.address, operatorA.permLevel, adminC.address, adminPermissions];
        await expect(
            callDelayed(addParticipant, gatekeeper, callArgumentsAdd, operatorA.address),
            "addParticipant did not revert correctly"
        ).to.be.revertedWith(reason);

        // Admin cannot change owner any more
        await expect(
            gatekeeper.scheduleChangeOwner(adminA.permLevel, adminC.address, {from: adminA.address}),
            "scheduleChangeOwner did not revert correctly"
        ).to.be.revertedWith(reason);

        // Watchdog cannot cancel operations any more

        await expect(
            gatekeeper.cancelOperation(watchdogA.permLevel, "0x123123", {from: watchdogA.address}),
            "cancelOperation did not revert correctly"
        ).to.be.revertedWith(reason);

        await expect(
            gatekeeper.cancelTransfer(watchdogA.permLevel, "0x123123", {from: watchdogA.address}),
            "cancelTransfer did not revert correctly"
        ).to.be.revertedWith(reason);

        // On the level of the freezer or up:
        // Admin can still call 'change owner'
        let res2 = await gatekeeper.scheduleChangeOwner(adminB1.permLevel, operatorB.address, {from: adminB1.address});
        // Watchdog can still cancel stuff

        let hash = getDelayedOpHashFromEvent(res2.logs[0]);
        let res3 = await gatekeeper.cancelOperation(watchdogB.permLevel, hash, {from: watchdogB.address});
        assert.equal(res3.logs[0].event, "DelayedOperationCancelled");
    });

    it("should not allow to shorten the length of a freeze");
    it("should not allow to lower the level of the freeze");

    it("should not allow non-boosters to unfreeze", async function () {

        await utils.asyncForEach(getNonBoosters(), async (signingParty) => {
            let encodedABI = gatekeeper.contract.methods.unfreeze(signingParty.address, signingParty.permLevel).encodeABI();
            let encodedPacked = utils.encodePackedBatch([encodedABI]);
            let encodedHash = utils.getTransactionHash(encodedPacked);
            let signature = await utils.signMessage(encodedHash, web3, {from: signingParty.address});
            await expect(
                gatekeeper.boostedConfigChange(adminB1.permLevel,
                    signingParty.permLevel,
                    encodedPacked,
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
        let encodedABI = gatekeeper.contract.methods.unfreeze(operatorA.address, operatorA.permLevel).encodeABI();
        let encodedPacked = utils.encodePackedBatch([encodedABI]);
        let encodedHash = utils.getTransactionHash(encodedPacked);
        let signature = await utils.signMessage(encodedHash, web3, {from: operatorA.address});
        let res1 = await gatekeeper.boostedConfigChange(
            adminB1.permLevel,
            operatorA.permLevel,
            encodedPacked,
            signature,
            {from: adminB1.address});
        let log1 = res1.logs[0];

        assert.equal(log1.event, "DelayedOperation");

        // Execute the scheduled unfreeze
        await utils.increaseTime(timeGap, web3);

        // Operator still cannot send money, not time-caused unfreeze
        await expect(
            gatekeeper.sendEther(destinationAddresss, amount, operatorA.permLevel, {from: operatorA.address})
        ).to.be.revertedWith("level is frozen");
        let res3 = await applyDelayed({log: log1}, adminB1, gatekeeper, adminB1, operatorA);
        let log3 = res3.logs[0];

        assert.equal(log3.event, "UnfreezeCompleted");

        let res2 = await gatekeeper.sendEther(destinationAddresss, amount, operatorA.permLevel);
        let log2 = res2.logs[0];
        assert.equal(log2.event, "DelayedOperation");
        assert.equal(log2.address, vault.address);

    });

    describe("when schedule happens before freeze", function () {

        it("should not allow to apply an already scheduled Delayed Op if the scheduler's rank is frozen", async function () {
            // Schedule a totally valid config change
            let callArguments = [operatorA.address, operatorA.permLevel, adminB1.address, adminB1.permLevel];
            let res1 = await callDelayed(addParticipant, gatekeeper, callArguments, operatorA.address);

            // Freeze the scheduler's rank
            await gatekeeper.freeze(watchdogB.permLevel, level, timeGap, {from: watchdogB.address});

            // Sender cannot apply anything - he is frozen
            await expect(
                applyDelayed({res: res1}, operatorA, gatekeeper)
            ).to.be.revertedWith("level is frozen");

            // Somebody who can apply cannot apply either
            await expect(
                applyDelayed({res: res1}, adminB1, gatekeeper, undefined, operatorA)
            ).to.be.revertedWith("scheduler level is frozen");
        });

        // TODO: actually call unfreeze, as the state is different. Actually, this is a bit of a problem. (extra state: outdated freeze). Is there a way to fix it?
        it("should not allow to apply an already scheduled boosted Delayed Op if the booster's rank is also frozen", async function () {
            // Schedule a boosted unfreeze by a high level admin
            let encodedABI = gatekeeper.contract.methods.unfreeze(operatorA.address, operatorA.permLevel).encodeABI();
            let encodedPacked = utils.encodePackedBatch([encodedABI]);
            let encodedHash = utils.getTransactionHash(encodedPacked);
            let signature = await utils.signMessage(encodedHash, web3, {from: operatorA.address});
            let res1 = await gatekeeper.boostedConfigChange(
                adminB1.permLevel,
                operatorA.permLevel,
                encodedPacked,
                signature,
                {from: adminB1.address});
            let log1 = res1.logs[0];
            assert.equal(log1.event, "DelayedOperation");


            // Increase freeze level to one above the old booster level
            await gatekeeper.freeze(watchdogZ.permLevel, highLevel, timeGap, {from: watchdogZ.address});

            // Admin with level 5 tries to apply the boosted operation
            await expect(
                applyDelayed({res: res1}, adminZ, gatekeeper, adminB1, operatorA)
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
        // Schedule config change by operator claiming to be an admin
        // note: this is not useful in current configuration, as operator can change everything and only the
        // operator can schedule. But in general, this requirement is a cornerstone of the "permissions model".
        let encodedABI = gatekeeper.contract.methods.addParticipant(adminA.address, adminA.permLevel, adminB1.address, adminB1.permLevel).encodeABI();
        let encodedPacked = utils.encodePackedBatch([encodedABI]);
        let res = await gatekeeper.changeConfiguration(operatorA.permLevel, encodedPacked);

        await utils.increaseTime(timeGap, web3);

        // operatorA cannot apply it - the 'sender' claimed is not the real sender
        await expect(
            applyDelayed({res}, operatorA, gatekeeper, undefined, operatorA)
        ).to.be.revertedWith("claimed sender is incorrect");

        // adminA cannot apply it for the operator either
        await expect(
            applyDelayed({res}, adminA, gatekeeper, undefined, operatorA)
        ).to.be.revertedWith("claimed sender is incorrect");

        // adminA cannot apply it for himself - will not even find it
        await expect(
            applyDelayed({res}, adminA, gatekeeper, undefined, undefined, true)
        ).to.be.revertedWith("applyDelayedOps called for non existing delayed op");

    });

    it("should revert an attempt to apply a boosted operation under some other participant's name");

    it("should revert an attempt to apply a boosted operation claiming wrong permissions");
    it("should revert an attempt to apply an operation claiming wrong permissions");

    after("write coverage report", async () => {
        await global.postCoverage()
    });
});