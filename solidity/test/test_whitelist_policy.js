const Chai = require('chai');
const web3 = require('web3');

const WhitelistBypassPolicy = artifacts.require("./WhitelistBypassPolicy.sol");
const DAI = artifacts.require("./DAI.sol");

const expect = Chai.expect;

Chai.use(require('ethereum-waffle').solidity);
Chai.use(require('bn-chai')(web3.utils.toBN));


contract('WhitelistBypassPolicy', async function (accounts) {

    let policy;
    let transferCall;
    let approveCall;
    let erc20;
    // TODO: 2^256, or uint(-1). How do I get it in JavaScript?
    let use_default_flag = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
    const anyAddress1 = "0x5409ED021D9299bf6814279A6A1411A7e866A631";
    const anyAddress2 = "0x2409ed021d9299bf6814279a6a1411a7e866a631";

    before(async function () {
        erc20 = await DAI.new();
        transferCall = erc20.contract.methods.transfer(anyAddress1, 200000).encodeABI();
        approveCall = erc20.contract.methods.approve(anyAddress1, 200000).encodeABI();
    });

    it("should accept a list of whitelisted addresses in the constructor", async function () {
        let whitelisted = [anyAddress2];
        policy = await WhitelistBypassPolicy.new(accounts[0], whitelisted);

        let policyForDest = await policy.getBypassPolicy(anyAddress2, 1, []);
        assert.equal(policyForDest[0].toString(), "0");
        assert.equal(policyForDest[1].toString(), "0");
    });

    it("should allow the gatekeeper to add whitelisted destinations", async function () {
        let res = await policy.addWhitelistedTarget(anyAddress1, true);
        assert.equal(res.logs[0].event, "WhitelistChanged");
        assert.equal(res.logs[0].args.destination, anyAddress1);
        assert.equal(res.logs[0].args.isWhitelisted, true);

        let policyForDest = await policy.getBypassPolicy(anyAddress1, 1, []);
        assert.equal(policyForDest[0].toString(), "0");
        assert.equal(policyForDest[1].toString(), "0");
    });

    it("should allow transfer and approval to the whitelisted destination of ERC-20 tokens", async function () {
        let policyForDest = await policy.getBypassPolicy(anyAddress1, 0, transferCall);
        assert.equal(policyForDest[0].toString(), "0");
        assert.equal(policyForDest[1].toString(), "0");
        policyForDest = await policy.getBypassPolicy(anyAddress1, 0, approveCall);
        assert.equal(policyForDest[0].toString(), "0");
        assert.equal(policyForDest[1].toString(), "0");
    });

    it("should allow the gatekeeper to remove whitelisted destinations", async function () {
        let res = await policy.addWhitelistedTarget(anyAddress1, false);
        assert.equal(res.logs[0].event, "WhitelistChanged");
        assert.equal(res.logs[0].args.destination, anyAddress1);
        assert.equal(res.logs[0].args.isWhitelisted, false);

        let policyForDest = await policy.getBypassPolicy(anyAddress1, 1, []);
        assert.equal(policyForDest[0].toString(), use_default_flag);
        assert.equal(policyForDest[1].toString(), use_default_flag);
    });

    it("should not allow unknown addresses to add whitelisted destinations", async function () {
        await expect(
            policy.addWhitelistedTarget(anyAddress1, false, {from: accounts[1]})
        ).to.be.revertedWith("only gatekeeper can change the whitelist");
    });

    it("should not allow calls with short message data", async function () {
        await expect(
            policy.getBypassPolicy(anyAddress1, 0, "0x60806080")
        ).to.be.revertedWith("transaction data is too short");
    });

    it("should not allow calls to unknown methods", async function () {
        // TODO: well, maybe we will want to enable 'transferFrom' in whitelists one day
        let call = erc20.contract.methods.transferFrom(anyAddress1, anyAddress1, 200000).encodeABI();
        await expect(
            policy.getBypassPolicy(anyAddress1, 0, call)
        ).to.be.revertedWith("method signature is not recognised");
    });

});