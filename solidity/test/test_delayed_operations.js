var DelayedOperations = artifacts.require("./DelayedOps.sol");

TestDelayedOp = artifacts.require("./tests/TestDelayedOps" )
const chai = require('chai')
const expect = chai.expect

const {createMockProvider, deployContract, getWallets, solidity} = require('ethereum-waffle');
chai.use(solidity)

const BN = web3.utils.toBN
var bnChai = require('bn-chai');
chai.use(bnChai(BN));

const utils = require( './utils')

contract('DelayedOperations', async (accounts) => {

    from=accounts[0]
    wrongaddr = accounts[1]
    var tcontract
    var trufflecontract
    var encoded

    after( "write coverage report", async ()=> {
        await global.postCoverage()
    })

    global.saveCoverageAtEnd(this)

    before( async ()=> {
        trufflecontract = await TestDelayedOp.new()
        //we use the web3 object, not the truffle helper wrapper..
        tcontract = trufflecontract.contract
    })


    it( "- revert on invalid delayedOp (not 'whitelisted' in validateOperation", async ()=>{

        await expect(
            tcontract.methods.sendOp(
                tcontract.methods.operationMissingFromValidate(from).encodeABI()
            ).send({from})
        ).to.be.revertedWith("delayed op not allowed")
    })

    it( "- revert on invalid delayedOp (not enough args)", async ()=>{

        await expect(
            tcontract.methods.sendOp(
                tcontract.methods.invalidOperationParams().encodeABI()
            ).send({from})
        ).to.be.revertedWith("not enough arguments")
    })

    it( "- revert on invalid delayedOp (wrong sender)", async ()=>{
        await expect(
            tcontract.methods.sendOp(
                tcontract.methods.doIncrement(wrongaddr).encodeABI()
            ).send({from})
        ).to.be.revertedWith("wrong sender for delayed op")
    })

    /* Positive flows */

    it("should emit event and save hash when new delayed operation is added", async ()=>{
        encoded = tcontract.methods.doIncrement(from).encodeABI()

        ret = await trufflecontract.sendOp(encoded)
        log = ret.logs[0]

        blocktime = (await web3.eth.getBlock('latest')).timestamp

        delay = log.args.dueTime.toString() - blocktime.toString()
        console.log( "delay = ", delay)
        assert.equal( log.args.sender, from)
        assert.equal( log.args.operation, encoded)
        assert.equal( log.event, "DelayedOperation")
    })

    it("should reject repeated event", async ()=>{

        await expect(
            tcontract.methods.sendOp(
                tcontract.methods.doIncrement(from).encodeABI()
            ).send({from})
        ).to.be.revertedWith("repeated delayed op")
    })

    it ( "should reject apply before time elapsed", async ()=>{
        await expect(
            trufflecontract.applyOp(encoded)
        ).to.be.revertedWith("called before due time")
    })

    it ( "should succeed after time elapsed", async ()=>{
        utils.increaseTime(3600*24*10)
        // await trufflecontract.setAllowedSender(from)

        counter = await trufflecontract.counter()
        await tcontract.methods.applyOp(encoded).send({from})
        expect( (await trufflecontract.counter()-counter) ).to.eq.BN(1)
    })

    //not sure what it means
    it("should be able to differentiate between two identical delayed operations");


    /* Negative flows */


    it("should not allow to create delayed operations without a delay");

    it("should not allow to execute a transaction before it's delay is expired");

    it("should not allow to execute the same transaction twice");

    it("should not allow to cancel an already executed transaction");
});