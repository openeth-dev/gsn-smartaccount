const TestDelayedOp = artifacts.require("./tests/TestDelayedOps");
const Chai = require('chai');

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

    before(async () => {
        trufflecontract = await TestDelayedOp.new();
        //we use the web3 object, not the truffle helper wrapper..
        testcontract = trufflecontract.contract;
        encodedDoIncrement = testcontract.methods.doIncrement(from, defaultDelay).encodeABI();
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
        console.log("delay = ", delay);
        assert.equal(log.event, "DelayedOperation");
        assert.equal(log.args.sender, from);
        assert.equal(log.args.operation, encodedDoIncrement);
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

        await expect(
            testcontract.methods.sendOp(encodedABI).send({from})
        ).to.be.revertedWith("delayed op not allowed")
    });

    it("revert on invalid delayedOp (not enough args)", async () => {
        let encodedABI = testcontract.methods.invalidOperationParams().encodeABI();
        await expect(
            testcontract.methods.sendOp(encodedABI).send({from})
        ).to.be.revertedWith("not enough arguments")
    });

    it("revert on invalid delayedOp (wrong sender)", async () => {
        let encodedABI = testcontract.methods.doIncrement(wrongaddr, defaultDelay).encodeABI();
        await expect(
            testcontract.methods.sendOp(encodedABI).send({from})
        ).to.be.revertedWith("wrong sender for delayed op")
    });

    it("reject apply before time elapsed", async () => {
        let res = await trufflecontract.sendOp(encodedDoIncrement);

        await expect(
            trufflecontract.applyOp(res.logs[0].args.operation, res.logs[0].args.opsNonce.toString())
        ).to.be.revertedWith("called before due time")
    });

    it("should allow to have different delay based on the delayedOp parameters", async function () {

        let encodedABI_short_failure = testcontract.methods.sayHelloWorld(from, 3600 * 2 - 10, 4, "short delay failure").encodeABI();
        let encodedABI_long_failure = testcontract.methods.sayHelloWorld(from, 3600 * 24 * 2 - 10, 11, "long delay failure").encodeABI();

        let encodedABI_short_success = testcontract.methods.sayHelloWorld(from, 3600 * 2 + 10, 4, "short delay success").encodeABI();
        let encodedABI_long_success = testcontract.methods.sayHelloWorld(from, 3600 * 24 * 2 + 10, 11, "long delay success").encodeABI();


        let res1 = await trufflecontract.sendOp(encodedABI_short_failure);
        let res2 = await trufflecontract.sendOp(encodedABI_long_failure);
        let res3 = await trufflecontract.sendOp(encodedABI_short_success);
        let res4 = await trufflecontract.sendOp(encodedABI_long_success);

        // It does not matter how much time actually passed - contract checks how much time was requested!
        await utils.increaseTime(3600 * 24 * 2 + 10);

        await expect(
            trufflecontract.applyOp(res1.logs[0].args.operation, res1.logs[0].args.opsNonce.toString())
        ).to.be.revertedWith("Born on thursdays must delay by 2 hours");

        await expect(
            trufflecontract.applyOp(res2.logs[0].args.operation, res2.logs[0].args.opsNonce.toString())
        ).to.be.revertedWith("Everybody must delay by 2 days");

        let apllyRes = await trufflecontract.applyOp(res3.logs[0].args.operation, res3.logs[0].args.opsNonce.toString());
        assert.equal(apllyRes.logs[1].event, 'HelloWorld');
        assert.equal(apllyRes.logs[1].args.message, "short delay success");

        apllyRes = await trufflecontract.applyOp(res4.logs[0].args.operation, res4.logs[0].args.opsNonce.toString());

        assert.equal(apllyRes.logs[1].event, 'HelloWorld');
        assert.equal(apllyRes.logs[1].args.message, "long delay success");

    });


    it("should not allow to create delayed operations without a delay");

    it("should not allow to execute a transaction before it's delay is expired");

    it("should not allow to execute the same transaction twice");

    it("should not allow to cancel an already executed transaction");
});