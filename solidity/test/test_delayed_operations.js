const TestDelayedOp = artifacts.require("./tests/TestDelayedOps");
const Chai = require('chai');
const ABI = require('ethereumjs-abi');

const expect = Chai.expect;

// const {createMockProvider, deployContract, getWallets, solidity} = ;
Chai.use(require('ethereum-waffle').solidity);
Chai.use(require('bn-chai')(web3.utils.toBN));


const utils = require('./utils');


contract('DelayedOperations', async function (accounts) {

    let from = accounts[0];
    let wrongaddr = accounts[1];
    let defaultDelay = 11;
    let testcontract;
    let trufflecontract;
    let encodedDoIncrement;

    async function extractLastDelayedOpsEvent() {
        let pastEvents = await trufflecontract.getPastEvents("DelayedOperation", {fromBlock: "latest"});
        assert.equal(pastEvents.length, 1);
        return pastEvents[0];
    }

    function bufferToHex(buffer) {
        return "0x" + buffer.toString("hex");
    }

    function encodePackedBatchOperation(encodedCalls) {
        let types = [];
        let values = [];
        for (let i = 0; i < encodedCalls.length; i++) {
            let encodedBuffer = Buffer.from(encodedCalls[i].slice(2), "hex");
            let encodedCallLengts = encodedBuffer.length;
            types = types.concat(["uint256", "bytes"]);
            values = values.concat([encodedCallLengts, encodedBuffer]);
        }
        return ABI.solidityPack(types, values);
    }

    before(async () => {
        trufflecontract = await TestDelayedOp.new();
        //we use the web3 object, not the truffle helper wrapper..
        testcontract = trufflecontract.contract;
        await trufflecontract.setAllowedSender(from);
        let encodedCall = testcontract.methods.doIncrement().encodeABI();

        encodedDoIncrement = encodePackedBatchOperation([encodedCall]);
    });

    after("write coverage report", async () => {
        await global.postCoverage()
    });

    /* Positive flows */

    it("emit event and save hash when new delayed operation is added", async () => {

        let ret = await trufflecontract.sendOp(encodedDoIncrement);
        let log = ret.logs[0];

        let blocktime = (await web3.eth.getBlock('latest')).timestamp;

        let delay = log.args.dueTime.toString() - blocktime.toString();
        assert.equal(log.event, "DelayedOperation");
        assert.equal(log.args.sender, from);
        assert.equal(log.args.operation, bufferToHex(encodedDoIncrement));
    });

    it("succeed to apply the delayed operation after time elapsed", async () => {

        let log = await extractLastDelayedOpsEvent();

        await utils.increaseTime(3600 * 24 * 2 + 10);

        let counterBefore = await trufflecontract.counter();
        await testcontract.methods.applyOp(log.args.operation, log.args.opsNonce.toString()).send({from});
        let counterAfter = await trufflecontract.counter();
        let diff = counterAfter - counterBefore;
        assert.equal(1, diff)
    });

    it("should be able to differentiate between two identical delayed operations", async () => {

        let counterBefore = await trufflecontract.counter();
        let res1 = await trufflecontract.sendOp(encodedDoIncrement);
        let res2 = await trufflecontract.sendOp(encodedDoIncrement);
        let log1 = res1.logs[0];
        let log2 = res2.logs[0];

        await utils.increaseTime(3600 * 24 * 2 + 10);

        await testcontract.methods.applyOp(log1.args.operation, log1.args.opsNonce.toString()).send({from});
        await testcontract.methods.applyOp(log2.args.operation, log2.args.opsNonce.toString()).send({from});

        let counterAfter = await trufflecontract.counter();
        assert.equal(counterAfter, parseInt(counterBefore) + 2);
    });


    /* Negative flows */

    it("revert on invalid delayedOp (not 'whitelisted' in 'validateOperation')", async () => {
        let encodedABI = testcontract.methods.operationMissingFromValidate(from, defaultDelay).encodeABI();
        let encodedPacked = encodePackedBatchOperation([encodedABI]);
        let res = await trufflecontract.sendOp(encodedPacked);

        await utils.increaseTime(3600 * 24 * 2 + 10);

        await expect(
            trufflecontract.applyOp(res.logs[0].args.operation, res.logs[0].args.opsNonce.toString())
        ).to.be.revertedWith("delayed op not allowed")
    });

    // TODO: can be left for contract to decide on that
    it("revert an attempt to apply operation scheduled by different sender");

    it("revert on invalid delayedOp (wrong sender)", async () => {
        let encodedABI = testcontract.methods.doIncrement().encodeABI();
        let encodedPacked = encodePackedBatchOperation([encodedABI]);
        let res = await trufflecontract.sendOp(encodedPacked, {from: wrongaddr});

        await utils.increaseTime(3600 * 24 * 2 + 10);
        await expect(
            trufflecontract.applyOp(res.logs[0].args.operation, res.logs[0].args.opsNonce.toString(), {from: wrongaddr})
        ).to.be.revertedWith("sender not allowed to perform this delayed op")
    });

    it("reject apply before time elapsed", async () => {
        let res = await trufflecontract.sendOp(encodedDoIncrement);

        await expect(
            trufflecontract.applyOp(res.logs[0].args.operation, res.logs[0].args.opsNonce.toString())
        ).to.be.revertedWith("called before due time")
    });


    // TODO: not really supported yet
    //  It is implemented with a set of hacks but it is not optimal in general
    //  If the contract needs an open 'applyBatch' then all operations will be scheduled with same delay
    it("should allow to have different delay based on the delayedOp parameters", async function () {

        let shortDelay = 3600 * 2;
        let longDelay = 3600 * 24 * 2;

        let encodedABI_cannot_schedule = testcontract.methods.sayHelloWorld(from, 4, "cannot schedule this").encodeABI();
        let encodedPacked_cannot_schedule = encodePackedBatchOperation([encodedABI_cannot_schedule]);

        await expect(
            trufflecontract.sendOp(encodedPacked_cannot_schedule)
        ).to.be.revertedWith("Cannot use sendOp to schedule secure HelloWorld");

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

        let apllyRes = await trufflecontract.applyOp(res3.logs[0].args.operation, res3.logs[0].args.opsNonce.toString());
        assert.equal(apllyRes.logs[0].event, 'HelloWorld');
        assert.equal(apllyRes.logs[0].args.message, "short delay success");

        apllyRes = await trufflecontract.applyOp(res4.logs[0].args.operation, res4.logs[0].args.opsNonce.toString());

        assert.equal(apllyRes.logs[0].event, 'HelloWorld');
        assert.equal(apllyRes.logs[0].args.message, "long delay success");

    });

    /** Batch config operations **/
    it("should allow the admin to create batched config changes", async function () {
        let somevalueBefore = await trufflecontract.someValue();
        assert.equal(somevalueBefore, 0);
        let encodedChangeA = await trufflecontract.addSome(2);
        let encodedChangeB = await trufflecontract.addSome(7);

        let packedChange;

        let somevalueAfter = await trufflecontract.someValue();
        // assert.equal(log.event, "DelayedOperationCancelled");

    });


    it("should not allow to create delayed operations without a delay");

    it("should not allow to execute a transaction before it's delay is expired");

    it("should not allow to execute the same transaction twice");

    it("should not allow to cancel an already executed transaction");
});