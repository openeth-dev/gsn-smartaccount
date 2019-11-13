const Chai = require('chai');
const Web3 = require('web3');

const Gatekeeper = artifacts.require("./Gatekeeper.sol");
const ChangeType = require('./etc/ChangeType');

const Participant = require('../src/js/Participant');
const utils = require('../src/js/SafeChannelUtils');

const expect = Chai.expect;

Chai.use(require('ethereum-waffle').solidity);
Chai.use(require('bn-chai')(web3.utils.toBN));


contract('GSN and Sponsor integration', async function (accounts) {

    // contracts
    let gatekeeper;
    let trustedCaller;
    let tokenSponsor;
    let relayHub;

    let relayServer;
    let vaultInteractor;

    let nonParticipant;
    let operatorA;
    let ownerPermissions;

    let actions;
    let args;

    async function nonce() {
        return parseInt(await gatekeeper.stateNonce());
    }

    before(async function () {
        gatekeeper = await Gatekeeper.deployed();
        ownerPermissions = utils.bufferToHex(await gatekeeper.ownerPermissions());
        operatorA = new Participant(accounts[0], ownerPermissions, 1, "operatorA");
        nonParticipant = new Participant(accounts[1], ownerPermissions, 1, "operatorA");
        let dummyAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
        relayServer = {address: dummyAddress};
        actions = [ChangeType.ADD_PARTICIPANT];
        args = [utils.participantHash(operatorA.address, operatorA.permLevel)];
        await gatekeeper.initialConfig(dummyAddress, [], []);
    });


    it("should accept a relayed call if it comes from a valid participant", async function () {

        let calldata = gatekeeper.contract.methods.changeConfiguration(operatorA.permLevel, actions, args, await nonce()).encodeABI();
        calldata += utils.removeHexPrefix(operatorA.address);

        // I know that gas-related params do not matter, so there is no need to test them now
        let result = await gatekeeper.acceptRelayedCall(relayServer.address, operatorA.address, calldata, 0, 0, 0, 0, [], 0);

        assert.equal("0", result[0].toString());
        assert.equal(null, result[1]);

    });

    it("should reject a relayed call if it doesn't come from a participant", async function () {

        let calldata = gatekeeper.contract.methods.changeConfiguration(operatorA.permLevel, actions, args, await nonce()).encodeABI();
        calldata += utils.removeHexPrefix(nonParticipant.address);

        // I know that gas-related params do not matter, so there is no need to test them now
        let result = await gatekeeper.acceptRelayedCall(relayServer.address, nonParticipant.address, calldata, 0, 0, 0, 0, [], 0);

        assert.equal("11", result[0].toString());
        let web3  = new Web3();
        assert.equal("Not vault participant", web3.utils.toAscii(result[1]));
    });

    it("should execute a schedule operation when called via the GSN", async function () {
        assert.fail();
    });

    it("should execute a schedule operation when called via the Sponsor Model", async function () {
        assert.fail();
    });

});