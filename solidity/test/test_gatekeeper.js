const Gatekeeper = artifacts.require("./Gatekeeper.sol");
const Vault = artifacts.require("./Vault.sol");
const Chai = require('chai');
const Web3 = require('web3');
const EthereumjsUtil = require('ethereumjs-util')

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

async function callDelayed(method, gatekeeper, callArguments, from) {
    // TODO: remove the first two parameters (scheduler, schedulerPermissions) if there will not arise a use case.
    assert.equal(true, (typeof callArguments[0]) === 'string' && EthereumjsUtil.isHexPrefixed(callArguments[0]));
    assert.equal(true, callArguments[1].length > 0 && callArguments[1].length < 6 && EthereumjsUtil.isHexPrefixed(callArguments[1]));

    let encodedABI = method(...callArguments).encodeABI();
    let encodedPacked = utils.encodePackedBatch([encodedABI]);
    return await gatekeeper.changeConfiguration(callArguments[0], callArguments[1], encodedPacked, {from: from});
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
    let zeroAddress = "0x0000000000000000000000000000000000000000";
    let operatorA = accounts[0];
    let operatorB = accounts[11];
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

    function validatePermission(participant) {
        if (![watchdogPermissions, adminPermissions, ownerPermissions].includes(participant.permissions)) {
            assert.fail("Check permissions value"); // this dumb array is apparently created before "before". Ooof.
        }
    }

    it("should not receive the initial configuration with too many participants", async function () {
        let initialDelays = [];
        let initialParticipants = Array(21).fill("0x1123123");
        await expect(
            gatekeeper.initialConfig(vault.address, initialParticipants, initialDelays)
        ).to.be.revertedWith("too many participants");
    });

    it("should not receive the initial configuration after configured once", async function () {
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
            utils.bufferToHex(utils.participantHash(adminA, adminPermissions, level)),
            utils.bufferToHex(utils.participantHash(adminB, adminPermissions, level)),
            utils.bufferToHex(utils.participantHash(watchdogA, watchdogPermissions, level))
        ];

        let res = await gatekeeper.initialConfig(vault.address, initialParticipants, initialDelays);
        let log = res.logs[0];
        assert.equal(log.event, "GatekeeperInitialized");
        assert.equal(log.args.vault, vault.address);

        operator = await gatekeeper.operator();
        assert.equal(operatorA, operator);

        let participants = [operatorA, adminA, adminB, watchdogA, watchdogB, operatorB, adminC, wrongaddr];
        let levels = [1, 1, 1, 1, 1, 1, 1, 1];
        let permissions = [ownerPermissions, adminPermissions, adminPermissions, watchdogPermissions, watchdogPermissions, adminPermissions, ownerPermissions, ownerPermissions];
        await utils.validateConfig(participants, levels, [true, true, true, true, false, false, false, false], permissions, gatekeeper);
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
        await web3.eth.sendTransaction({from: operatorA, to: vault.address, value: amount * 10});
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

    [{address: operatorA, title: "owner"}, {address: watchdogA, title: "watchdog"}].forEach((participant) => {
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
        let encodedABI = gatekeeper.contract.methods.addParticipant(operatorA, ownerPermissions, adminB1, ownerPermissions, level).encodeABI();
        let encodedPacked = utils.encodePackedBatch([encodedABI]);

        let callArguments = [operatorA, ownerPermissions, adminB1, ownerPermissions, level];
        let res = await callDelayed(addParticipant, gatekeeper, callArguments, operatorA);
        let log = res.logs[0];
        assert.equal(log.event, "DelayedOperation");
        assert.equal(log.address, gatekeeper.address);
        assert.equal(log.args.sender, operatorA);
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

        await utils.validateConfig(
            [adminA, adminB, adminB1],
            [1, 1, 1],
            [true, true, false],
            Array(3).fill(adminPermissions),
            gatekeeper);
    });

    it("should revert an attempt to delete admin that is not a part of the config", async function () {
        let callArguments = [operatorA, ownerPermissions, utils.participantHash(adminC, adminPermissions, level)];
        let res = await callDelayed(removeParticipant, gatekeeper, callArguments, operatorA);
        let log = res.logs[0];
        assert.equal(log.event, "DelayedOperation");
        await utils.increaseTime(3600 * 24 * 2 + 10);
        await expect(
            gatekeeper.applyBatch(res.logs[0].args.operation, ownerPermissions, res.logs[0].args.opsNonce.toString())
        ).to.be.revertedWith("there is no such participant");
    });

    it("should allow the owner to add an admin after a delay", async function () {
        let callArguments = [operatorA, ownerPermissions, adminC, adminPermissions, level];
        let res = await callDelayed(addParticipant, gatekeeper, callArguments, operatorA);
        await expect(
            gatekeeper.applyBatch(res.logs[0].args.operation, ownerPermissions, res.logs[0].args.opsNonce.toString())
        ).to.be.revertedWith("called before due time");
        await utils.increaseTime(3600 * 24 * 2 + 10);
        let res2 = await gatekeeper.applyBatch(res.logs[0].args.operation, ownerPermissions, res.logs[0].args.opsNonce.toString());
        let log2 = res2.logs[0];
        let hash = utils.bufferToHex(utils.participantHash(adminC, adminPermissions, level));
        assert.equal(log2.event, "ParticipantAdded");
        assert.equal(log2.args.participant, hash);
        await utils.validateConfig(
            [adminA, adminB, adminB1, adminC],
            [1, 1, 1, 1],
            [true, true, false, true],
            Array(4).fill(adminPermissions),
            gatekeeper);
    });

    it("should allow the owner to delete an admin after a delay", async function () {
        let callArguments = [operatorA, ownerPermissions, utils.participantHash(adminC, adminPermissions, level)];
        let res = await callDelayed(removeParticipant, gatekeeper, callArguments, operatorA);
        let log = res.logs[0];
        assert.equal(log.event, "DelayedOperation");
        await utils.increaseTime(3600 * 24 * 2 + 10);
        let res2 = await gatekeeper.applyBatch(res.logs[0].args.operation, ownerPermissions, res.logs[0].args.opsNonce.toString());
        assert.equal(res2.logs[0].event, "ParticipantRemoved");
        await utils.validateConfig(
            [adminA, adminB, adminB1, adminC],
            [1, 1, 1, 1],
            [true, true, false, false],
            Array(4).fill(adminPermissions),
            gatekeeper);

    });

    /* Admin replaced */
    it("should allow the owner to replace an admin after a delay", async function () {
        let encodedABI_add_adminB1 = gatekeeper.contract.methods.addParticipant(operatorA, ownerPermissions, adminB1, adminPermissions, level).encodeABI();
        let encodedABI_remove_adminB = gatekeeper.contract.methods.removeParticipant(operatorA, ownerPermissions, utils.participantHash(adminB, adminPermissions, level)).encodeABI();
        let encodedPacked = utils.encodePackedBatch([encodedABI_add_adminB1, encodedABI_remove_adminB]);
        let res = await gatekeeper.changeConfiguration(operatorA, ownerPermissions, encodedPacked);

        await expect(
            gatekeeper.applyBatch(res.logs[0].args.operation, ownerPermissions, res.logs[0].args.opsNonce.toString())
        ).to.be.revertedWith("called before due time");

        await utils.increaseTime(3600 * 24 * 2 + 10);

        let res2 = await gatekeeper.applyBatch(res.logs[0].args.operation, ownerPermissions, res.logs[0].args.opsNonce.toString());

        assert.equal(res2.logs[0].event, "ParticipantAdded");
        assert.equal(res2.logs[1].event, "ParticipantRemoved");

        await utils.validateConfig(
            [adminA, adminB, adminB1, adminC],
            [1, 1, 1, 1],
            [true, false, true, false],
            Array(4).fill(adminPermissions),
            gatekeeper);
    });

    it("should only allow one operator in vault", async function () {
        // as we keep the 'require'-ment to use pre-approved permissions, operator
        // is defined as an account with 'ownerPermissions'
        let callArguments = [operatorA, ownerPermissions, wrongaddr, ownerPermissions, level];
        let res1 = await callDelayed(addParticipant, gatekeeper, callArguments, operatorA);
        await utils.increaseTime(3600 * 24 * 2 + 10);
        await gatekeeper.applyBatch(res1.logs[0].args.operation, ownerPermissions, res1.logs[0].args.opsNonce.toString());
        // as per spec file, another 'operator' can be added as a participant, but cannot use it's permissions
        await utils.validateConfig([wrongaddr], [1], [true], [ownerPermissions], gatekeeper);

        let anyCallArguments = [wrongaddr, ownerPermissions, wrongaddr, ownerPermissions, level];
        await expect(
            callDelayed(addParticipant, gatekeeper, anyCallArguments, wrongaddr)
        ).to.be.revertedWith("This participant is not a real operator, fix your vault configuration");

        // Clean up
        let callArgumentsCleanUp = [operatorA, ownerPermissions, utils.participantHash(wrongaddr, ownerPermissions, level)];
        let res2 = await callDelayed(removeParticipant, gatekeeper, callArgumentsCleanUp, operatorA);
        await utils.increaseTime(3600 * 24 * 2 + 10);
        await gatekeeper.applyBatch(res2.logs[0].args.operation, ownerPermissions, res2.logs[0].args.opsNonce.toString());
        await utils.validateConfig([wrongaddr], [1], [false], [ownerPermissions], gatekeeper);
    });

    // TODO: these two tests are identical. Combine into 1 looped test.
    /* Owner loses phone*/
    it("should allow the admin to replace the owner after a delay", async function () {
        let admins = [operatorA, operatorB];
        let levels = [1, 1];
        let permissions = [ownerPermissions, ownerPermissions];
        await utils.validateConfig(admins, levels, [true, false], permissions, gatekeeper);
        let res = await gatekeeper.scheduleChangeOwner(adminPermissions, operatorB, {from: adminA});
        await utils.increaseTime(3600 * 24 * 2 + 10);
        await gatekeeper.applyBatch(res.logs[0].args.operation, adminPermissions, res.logs[0].args.opsNonce.toString(), {from: adminA});
        await utils.validateConfig(admins, levels, [false, true], permissions, gatekeeper);
    });

    /* There is no scenario where this is described, but this is how it was implemented and now it is documented*/
    it("should allow the owner to replace the owner after a delay", async function () {
        let admins = [operatorA, operatorB];
        let levels = [1, 1];
        let permissions = [ownerPermissions, ownerPermissions];
        await utils.validateConfig(admins, levels, [false, true], permissions, gatekeeper);
        let res = await gatekeeper.scheduleChangeOwner(ownerPermissions, operatorA, {from: operatorB});
        await utils.increaseTime(3600 * 24 * 2 + 10);
        await gatekeeper.applyBatch(res.logs[0].args.operation, ownerPermissions, res.logs[0].args.opsNonce.toString(), {from: operatorB});
        await utils.validateConfig(admins, levels, [true, false], permissions, gatekeeper);
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

    function getNonSpenders() {
        return getNonConfigChangers();
    }

    function getNonChowners() {
        return [
            {address: watchdogA, title: "watchdog", permissions: "0x26", expectError: "not allowed"},
            {address: wrongaddr, title: "non-participant", permissions: "0x53f", expectError: "not participant"}
        ];
    }

    function getNonConfigChangers() {
        return [
            {address: adminA, title: "admin", permissions: "0x600", expectError: "not allowed"},
            {address: watchdogA, title: "watchdog", permissions: "0x26", expectError: "not allowed"},
            {address: wrongaddr, title: "non-participant", permissions: "0x53f", expectError: "not participant"}
        ];
    }

    getNonChowners().forEach((participant) => {
        it(`should not allow \${${participant.title}} to change owner`, async function () {
            validatePermission(participant);
            await expect(
                gatekeeper.scheduleChangeOwner(participant.permissions, adminC, {from: participant.address})
            ).to.be.revertedWith(participant.expectError);
        });
    });

    /* Admin replaced - opposite  & Owner loses phone - opposite */
    getNonConfigChangers().forEach((participant) => {
        it(`should not allow \${${participant.title}} to add or remove admins or watchdogs`, async function () {
            validatePermission(participant);
            let callArgumentsAdd = [participant.address, participant.permissions, adminC, ownerPermissions, level];
            await expect(
                callDelayed(addParticipant, gatekeeper, callArgumentsAdd, participant.address)
            ).to.be.revertedWith(participant.expectError);

            let callArgumentsRemove = [participant.address, participant.permissions, utils.participantHash(adminA, adminPermissions, level)];
            await expect(
                callDelayed(removeParticipant, gatekeeper, callArgumentsRemove, participant.address)
            ).to.be.revertedWith(participant.expectError);

        });
    });

    getNonChowners().forEach((participant) => {
        it(`should not allow \${${participant.title}} to create a delayed transfer transaction`, async function () {
            validatePermission(participant);
            await expect(
                gatekeeper.sendEther(destinationAddresss, amount,  participant.permissions, {from: participant.address})
            ).to.be.revertedWith(participant.expectError);
        });
    });

    it("should validate correctness of claimed senderPermissions");
    it("should validate correctness of claimed sender address");
    it("should not allow any operation to be called without a delay");

});