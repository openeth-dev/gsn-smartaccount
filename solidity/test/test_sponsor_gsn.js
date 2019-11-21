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
    let tokenSponsor;
    let relayHub = "0x0000000000000000000000000000000000000000";

    let relayServer;
    let gsnForwarder;
    let vaultInteractor;

    let nonParticipant;
    let operatorA;
    let ownerPermissions;

    let actions;
    let args;

    let web3;

    async function nonce() {
        return parseInt(await gatekeeper.stateNonce());
    }

    before(async function () {
        gsnForwarder = accounts[14];
        gatekeeper = await Gatekeeper.deployed();
        web3 = new Web3(gatekeeper.contract.currentProvider);
        ownerPermissions = utils.bufferToHex(await gatekeeper.ownerPermissions());
        operatorA = new Participant(accounts[0], ownerPermissions, 1, "operatorA");
        nonParticipant = new Participant(accounts[1], ownerPermissions, 1, "operatorA");
        let dummyAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
        relayServer = {address: dummyAddress};
        actions = [ChangeType.ADD_PARTICIPANT];
        args = [utils.participantHash(operatorA.address, operatorA.permLevel)];
        const minuteInSec = 60;
        const hourInSec = 60 * minuteInSec;
        const dayInSec = 24 * hourInSec;
        let initialDelays = Array.from({length: 10}, (x, i) => (i + 1) * dayInSec);
        await gatekeeper.initialConfig(args, initialDelays, gsnForwarder, relayHub, true, true, [0,0,0]);
    });


    it("should accept a relayed call if it comes from a valid participant", async function () {

        let calldata = gatekeeper.contract.methods.changeConfiguration(operatorA.permLevel, actions, args, args, await nonce()).encodeABI();

        // Call to acceptRelayedCall is performed by either the RelayHub, or a trusted GSNForwarder, so 'from' field is reliable
        // I know that gas-related params do not matter, so there is no need to test them now
        let result = await gatekeeper.acceptRelayedCall(relayServer.address, operatorA.address, calldata, 0, 0, 0, 0, [], 0);

        assert.equal("0", result[0].toString());
        assert.equal(null, result[1]);

    });

    it("should reject a relayed call if it doesn't come from a participant", async function () {

        let calldata = gatekeeper.contract.methods.changeConfiguration(operatorA.permLevel, actions, args, args, await nonce()).encodeABI();

        // I know that gas-related params do not matter, so there is no need to test them now
        let result = await gatekeeper.acceptRelayedCall(relayServer.address, nonParticipant.address, calldata, 0, 0, 0, 0, [], 0);

        assert.equal("11", result[0].toString());
        assert.equal("Not vault participant", web3.utils.toAscii(result[1]));
    });


    it("should execute a schedule operation when called via the GSN", async function () {
        let calldata = gatekeeper.contract.methods.changeConfiguration(operatorA.permLevel, actions, args, args, await nonce()).encodeABI();
        calldata += utils.removeHexPrefix(operatorA.address);

        let res = await web3.eth.sendTransaction({
            from: gsnForwarder,
            to: gatekeeper.address,
            value: 0,
            data: calldata,
            gas: 5e6,
        });
        let decodedLogs = Gatekeeper.decodeLogs(res.logs);
        assert.equal(decodedLogs[0].event, "ConfigPending");
    });

    it("should revert a relayed call if it doesn't come from a trusted GSN Forwarder", async function () {
        let calldata = gatekeeper.contract.methods.changeConfiguration(operatorA.permLevel, actions, args, args, await nonce()).encodeABI();
        calldata += utils.removeHexPrefix(operatorA.address);
        await expect(web3.eth.sendTransaction({
                from: nonParticipant.address,
                to: gatekeeper.address,
                value: 0,
                data: calldata
            })
        ).to.be.revertedWith("not participant")
    });

    it("should revert a relayed call if it doesn't come from a valid participant", async function () {
        let calldata = gatekeeper.contract.methods.changeConfiguration(operatorA.permLevel, actions, args, args, await nonce()).encodeABI();
        calldata += utils.removeHexPrefix(nonParticipant.address);
        await expect(
            web3.eth.sendTransaction({
                from: gsnForwarder,
                to: gatekeeper.address,
                value: 0,
                data: calldata
            })
        ).to.be.revertedWith("not participant");
    });

});