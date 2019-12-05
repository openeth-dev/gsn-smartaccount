const VaultFactory = artifacts.require("./VaultFactory.sol");
const RelayHub = artifacts.require("./RelayHub.sol");
const MockGsnForwarder = artifacts.require("./tests/MockGsnForwarder.sol");

const crypto = require("crypto");
const Chai = require('chai');
const expect = Chai.expect;

contract('VaultFactory', function (accounts) {
    let mockForwarder
    let mockHub
    let vaultFactory
    let callData
    let vaultId
    const zeroAddress = "0x0000000000000000000000000000000000000000";

    before( async function (){

        vaultId = crypto.randomBytes(32)
        mockHub = await RelayHub.new({gas:9e6});
        mockForwarder = await MockGsnForwarder.new(mockHub.address, {gas:9e6});
        vaultFactory = await VaultFactory.new(mockForwarder.address, {gas:9e6});
        callData = vaultFactory.contract.methods.newVault(vaultId).encodeABI()
    });

    it("should revert on calling without GSN", async function () {
        await expect(
          vaultFactory.newVault(vaultId)
        ).to.be.revertedWith("Must be called through GSN")
    });

    it("should deploy vault and gatekeeper", async function () {

        let sender = accounts[0]
        // TODO: this should be 'await vaultFactory.newVault(crypto.randomBytes(32),{from: mockHub})'
        //  once we remove redundant tests inside recipient & forwarder constructors and setters.
        let res = await mockForwarder.mockCallRecipient(sender, vaultFactory.address, callData)
        let event = res.logs[0];

        assert.equal(event.event, "VaultCreated");
        assert.equal(event.args.sender, sender);
    });

    it("should revert when deploying with same vaultId", async function () {
        await expect(
          mockForwarder.mockCallRecipient(zeroAddress, vaultFactory.address, callData)
        ).to.be.revertedWith("Vault already created for this id")
    });

    after("write coverage report", async () => {
        await global.postCoverage()
    });
});
