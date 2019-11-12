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

    let operatorA;
    let ownerPermissions;

    before(async function () {
        gatekeeper = await Gatekeeper.deployed();
        ownerPermissions = utils.bufferToHex(await gatekeeper.ownerPermissions());
        operatorA = new Participant(accounts[0], ownerPermissions, 1, "operatorA");
        relayServer = {address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"};
    });


    it("should accept a relayed call if it comes from a valid participant", async function () {

        // function changeConfiguration(uint8[] memory actions, bytes32[] memory args, uint256 targetStateNonce, uint16 senderPermsLevel) public
        let actions = [ChangeType.ADD_PARTICIPANT];
        let args = [utils.participantHash(operatorA.address, operatorA.permLevel)];
        let stateNonce = parseInt(await gatekeeper.stateNonce());
        let calldata = gatekeeper.contract.methods.changeConfiguration(actions, args, stateNonce, operatorA.permLevel).encodeABI();
        calldata += utils.removeHexPrefix(operatorA.address);

        // I know that gas-related params do not matter, so there is no need to test them now
        let result = await gatekeeper.acceptRelayedCall(relayServer.address, operatorA.address, calldata, 0, 0, 0, 0, [], 0);

        assert.equal("0", result[0].toString());
        assert.equal(null, result[1]);

    });

    it("should reject a relayed call if it doesn't come from a participant", async function () {
        assert.fail();
    });

    it("should execute a schedule operation when called via the GSN", async function () {
        assert.fail();
    });

    it("should execute a schedule operation when called via the Sponsor Model", async function () {
        assert.fail();
    });

});