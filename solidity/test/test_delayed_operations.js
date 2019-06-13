const TestDelayedOp = artifacts.require("./tests/TestDelayedOps");
const Chai = require('chai');

const expect = Chai.expect;

const {createMockProvider, deployContract, getWallets, solidity} = require('ethereum-waffle');
Chai.use(solidity);

const BN = web3.utils.toBN;
var bnChai = require('bn-chai');
Chai.use(bnChai(BN));

const utils = require('./utils');


contract('DelayedOperations', async (accounts) => {

    let from = accounts[0];
    let wrongaddr = accounts[1];
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
        encodedDoIncrement = testcontract.methods.doIncrement(from).encodeABI();
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
        assert.equal(log.args.sender, from);
        assert.equal(log.args.operation, encodedDoIncrement);
        assert.equal(log.event, "DelayedOperation")
    });

    it("succeed to apply the delayed operation after time elapsed", async () => {

        let log = await extractLastDelayedOpsEvent();

        utils.increaseTime(3600 * 24 * 10);

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

        utils.increaseTime(3600 * 24 * 10);

        await testcontract.methods.applyOp(log1.args.operation, log1.args.opsNonce.toString()).send({from});
        await testcontract.methods.applyOp(log2.args.operation, log2.args.opsNonce.toString()).send({from});

        let counterAfter = await trufflecontract.counter();
        assert.equal(counterAfter, parseInt(counterBefore) + 2);
    });


    /* Negative flows */

    it("revert on invalid delayedOp (not 'whitelisted' in 'validateOperation')", async () => {
        let encodedABI = testcontract.methods.operationMissingFromValidate(from).encodeABI();

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
        let encodedABI = testcontract.methods.doIncrement(wrongaddr).encodeABI();
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

    it("should not allow to create delayed operations without a delay");

    it("should not allow to execute a transaction before it's delay is expired");

    it("should not allow to execute the same transaction twice");

    it("should not allow to cancel an already executed transaction");
});