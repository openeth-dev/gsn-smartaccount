const TestDelayedOp = artifacts.require("./tests/TestDelayedOps");
const Chai = require('chai');
const ABI = require('ethereumjs-abi');

const expect = Chai.expect;

Chai.use(require('ethereum-waffle').solidity);
Chai.use(require('bn-chai')(web3.utils.toBN));


const utils = require('./utils');


contract('DelayedOperations', async function (accounts) {

    let from = accounts[0];
    let wrongaddr = accounts[1];
    let defaultDelay = 11;
    let allowedExtraData = "0x0000000000000000000000000000000000000000000000000000000000001234";
    let testcontract;
    let trufflecontract;
    let encodedDoIncrement;

    before(async () => {
        trufflecontract = await TestDelayedOp.new();
        //we use the web3 object, not the truffle helper wrapper..
        testcontract = trufflecontract.contract;
        await trufflecontract.setAllowedSender(from);
        let encodedCall = testcontract.methods.doIncrement().encodeABI();

        encodedDoIncrement = utils.encodePackedBatch([encodedCall]);
    });

    after("write coverage report", async () => {
        await global.postCoverage()
    });

    /* Common sense */
    it("prevent non-delayed calls to operations that require delay", async function () {
        await expect(
            trufflecontract.doIncrement()
        ).to.be.revertedWith("this operation must be scheduled")
    });

    /* Positive flows */

    it("emit event and save hash when new delayed operation is added", async () => {

        let ret = await trufflecontract.sendBatch(encodedDoIncrement, 0);
        let log = ret.logs[0];

        let expectedMetadata = "0x" + ABI.rawEncode(["address", "bytes32"], [from, "0x0"]).toString("hex");
        assert.equal(log.event, "DelayedOperation");
        assert.equal(log.args.batchMetadata, expectedMetadata);
        assert.equal(log.args.operation, utils.bufferToHex(encodedDoIncrement));
    });

    it("succeed to apply the delayed operation after time elapsed", async () => {

        let log = await utils.extractLastDelayedOpsEvent(trufflecontract);

        await utils.increaseTime(3600 * 24 * 2 + 10);

        let counterBefore = await trufflecontract.counter();
        await testcontract.methods.applyOp(log.args.operation, log.args.batchMetadata, log.args.opsNonce.toString()).send({from});
        let counterAfter = await trufflecontract.counter();
        let diff = counterAfter - counterBefore;
        assert.equal(1, diff)
    });

    it("allow to accept or decline the entire scheduled ops batch based on the 'extraData' field", async function () {
        let res = await trufflecontract.sendBatch(encodedDoIncrement, allowedExtraData);
        await utils.increaseTime(3600 * 24 * 2 + 10);
        let log = res.logs[0];
        await expect(
            trufflecontract.applyOp(log.args.operation, log.args.batchMetadata, log.args.opsNonce.toString())
        ).to.be.revertedWith("extraData is not allowed");
        await trufflecontract.setAllowedExtraData(allowedExtraData);
        let counterBefore = await trufflecontract.counter();
        await testcontract.methods.applyOp(log.args.operation, log.args.batchMetadata, log.args.opsNonce.toString()).send({from});
        let counterAfter = await trufflecontract.counter();
        let diff = counterAfter - counterBefore;
        assert.equal(1, diff);
        await trufflecontract.setAllowedExtraData("0x00");
    });


    it("allow to accept or decline a specific scheduled op based on the 'batchMetadata' field", async function () {
        // schedule two operations: 'doIncrement' and 'addSome'
        let res_increment = await trufflecontract.sendBatch(encodedDoIncrement, allowedExtraData);
        let encodedAddSome = testcontract.methods.addSome(allowedExtraData, 1).encodeABI();
        let encodedAddSomePacked = utils.encodePackedBatch([encodedAddSome]);
        let res_addSome = await trufflecontract.sendBatch(encodedAddSomePacked, allowedExtraData);
        let log_increment = res_increment.logs[0];
        let log_addSome = res_addSome.logs[0];

        await utils.increaseTime(3600 * 24 * 2 + 10);

        // both of them were scheduled with illegal extraData
        await expect(
            trufflecontract.applyOp(log_increment.args.operation, log_increment.args.batchMetadata, log_increment.args.opsNonce.toString())
        ).to.be.revertedWith("extraData is not allowed");
        await expect(
            trufflecontract.applyOp(log_addSome.args.operation, log_addSome.args.batchMetadata, log_addSome.args.opsNonce.toString())
        ).to.be.revertedWith("extraData is not allowed");

        // Set allowed extraData specifically for 'addSome'
        await trufflecontract.setAllowedExtraDataForAddSome(allowedExtraData);

        // 'doIncrement' still fails
        await expect(
            trufflecontract.applyOp(log_increment.args.operation, log_increment.args.batchMetadata, log_increment.args.opsNonce.toString())
        ).to.be.revertedWith("extraData is not allowed");

        // 'addSome' succeeds
        let somevalueBefore = await trufflecontract.someValue();
        await trufflecontract.applyOp(log_addSome.args.operation, log_addSome.args.batchMetadata, log_addSome.args.opsNonce.toString())
        let somevalueAfter = await trufflecontract.someValue();
        assert.equal(somevalueAfter, 1 + somevalueBefore.toNumber());

        // Set allowed extraData back to 0
        await trufflecontract.setAllowedExtraDataForAddSome("0x00");
    });


    it("should be able to differentiate between two identical delayed operations", async () => {

        let counterBefore = await trufflecontract.counter();
        let res1 = await trufflecontract.sendBatch(encodedDoIncrement, 0);
        let res2 = await trufflecontract.sendBatch(encodedDoIncrement, 0);
        let log1 = res1.logs[0];
        let log2 = res2.logs[0];

        await utils.increaseTime(3600 * 24 * 2 + 10);

        await testcontract.methods.applyOp(log1.args.operation, log1.args.batchMetadata, log1.args.opsNonce.toString()).send({from});
        await testcontract.methods.applyOp(log2.args.operation, log1.args.batchMetadata, log2.args.opsNonce.toString()).send({from});

        let counterAfter = await trufflecontract.counter();
        assert.equal(counterAfter, parseInt(counterBefore) + 2);
    });


    /* Negative flows */

    it("revert on invalid delayedOp (not 'whitelisted' in 'validateOperation')", async () => {
        let encodedABI = testcontract.methods.operationMissingFromValidate(from, defaultDelay).encodeABI();
        let encodedPacked = utils.encodePackedBatch([encodedABI]);
        let res = await trufflecontract.sendBatch(encodedPacked, 0);

        await utils.increaseTime(3600 * 24 * 2 + 10);

        await expect(
            trufflecontract.applyOp(res.logs[0].args.operation, res.logs[0].args.batchMetadata, res.logs[0].args.opsNonce.toString())
        ).to.be.revertedWith("delayed op not allowed")
    });

    it("allow the implementing contract to revert applying operation depending on sender", async function () {
        let encodedABI = testcontract.methods.doIncrement().encodeABI();
        let encodedPacked = utils.encodePackedBatch([encodedABI]);
        let res = await trufflecontract.sendBatch(encodedPacked, 0, {from: wrongaddr});

        await utils.increaseTime(3600 * 24 * 2 + 10);
        await expect(
            trufflecontract.applyOp(res.logs[0].args.operation, res.logs[0].args.batchMetadata, res.logs[0].args.opsNonce.toString(), {from: wrongaddr})
        ).to.be.revertedWith("this sender not allowed to apply delayed operations")
    });

    it("reject apply before time elapsed", async () => {
        let res = await trufflecontract.sendBatch(encodedDoIncrement, 0);

        await expect(
            trufflecontract.applyOp(res.logs[0].args.operation, res.logs[0].args.batchMetadata, res.logs[0].args.opsNonce.toString())
        ).to.be.revertedWith("called before due time")
    });


    // TODO: not really supported yet
    //  It is implemented with a set of hacks but it is not optimal in general
    //  If the contract needs an open 'applyBatch' then all operations will be scheduled with same delay
    it("should allow to have different delay based on the delayedOp parameters", async function () {

        let shortDelay = 3600 * 2;
        let longDelay = 3600 * 24 * 2;

        let encodedABI_cannot_schedule = testcontract.methods.sayHelloWorld(from, 4, "cannot schedule this").encodeABI();
        let encodedPacked_cannot_schedule = utils.encodePackedBatch([encodedABI_cannot_schedule]);

        await expect(
            trufflecontract.sendBatch(encodedPacked_cannot_schedule, 0)
        ).to.be.revertedWith("Cannot use sendBatch to schedule secure HelloWorld");

        await expect(
            trufflecontract.scheduleHelloWorld(4, "short delay failure", shortDelay - 10)
        ).to.be.revertedWith("Born on thursdays must delay by 2 hours");

        await expect(
            trufflecontract.scheduleHelloWorld(11, "long delay failure", longDelay - 10)
        ).to.be.revertedWith("Everybody must delay by 2 days");

        let res3 = await trufflecontract.scheduleHelloWorld(4, "short delay success", shortDelay + 10);
        let res4 = await trufflecontract.scheduleHelloWorld(11, "long delay success", longDelay + 10);

        // It does not matter how much time actually passed - contract checks how much time was requested!
        await utils.increaseTime(longDelay + 20);

        let apllyRes = await trufflecontract.applyOp(res3.logs[0].args.operation, res3.logs[0].args.batchMetadata, res3.logs[0].args.opsNonce.toString());
        assert.equal(apllyRes.logs[0].event, 'HelloWorld');
        assert.equal(apllyRes.logs[0].args.message, "short delay success");

        apllyRes = await trufflecontract.applyOp(res4.logs[0].args.operation, res4.logs[0].args.batchMetadata, res4.logs[0].args.opsNonce.toString());

        assert.equal(apllyRes.logs[0].event, 'HelloWorld');
        assert.equal(apllyRes.logs[0].args.message, "long delay success");

    });

    /** Batch config operations **/
    it("should allow to create batched config changes", async function () {
        let somevalueBefore = await trufflecontract.someValue();
        assert.equal(somevalueBefore, 1);
        let valA = 2;
        let encodedChangeA = testcontract.methods.addSome("0x0", valA).encodeABI();
        let valB = 7;
        let encodedChangeB = testcontract.methods.addSome("0x0", valB).encodeABI();

        let encodedPacked = utils.encodePackedBatch([encodedChangeA, encodedChangeB]);

        let res = await trufflecontract.sendBatch(encodedPacked, 0);

        await utils.increaseTime(3600 * 24 * 2 + 10);
        await trufflecontract.applyOp(res.logs[0].args.operation, res.logs[0].args.batchMetadata, res.logs[0].args.opsNonce.toString());

        let somevalueAfter = await trufflecontract.someValue();
        assert.equal(somevalueAfter, valA + valB + somevalueBefore.toNumber());

    });


    it("should not allow to create delayed operations without a delay");

    it("should not allow to execute a transaction before it's delay is expired");

    it("should not allow to execute the same transaction twice");

    it("should not allow to cancel an already executed transaction");
});