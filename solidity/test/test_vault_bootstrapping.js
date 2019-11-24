/* npm modules */
const Chai = require('chai');
const GsnUtils = require('tabookey-gasless/src/js/relayclient/utils');
const RelayClient = require('tabookey-gasless/src/js/relayclient/RelayClient');

/* truffle artifacts */
const DAI = artifacts.require("./DAI.sol");
const Gatekeeper = artifacts.require("./Gatekeeper.sol");

// Ok, so here is a thing: Truffle has some weird internals; I need this object to exist
const UtilitiesNetwork = artifacts.require("./Utilities.sol").network;

const RelayHub = artifacts.require("RelayHub");
const VaultFactory = artifacts.require("VaultFactory");
const GsnForwarder = artifacts.require("GsnForwarder");
const WhitelistFactory = artifacts.require("WhitelistFactory");
const FreeRecipientSponsor = artifacts.require("FreeRecipientSponsor");

const expect = Chai.expect;

Chai.use(require('ethereum-waffle').solidity);
Chai.use(require('bn-chai')(web3.utils.toBN));

/**
 * A full contracts integration test: relay hub -> forwarder -> sponsor -> factories -> gatekeeper.
 * The purpose of this test is to prove that we can create a new vault for
 * our users with a configuration that is needed without unreasonable limitations
 * (like, insecure vault state, multiple delay periods, etc.)
 */
contract("Vault Bootstrapping", async function (accounts) {

    const anyAddress1 = "0x5409ED021D9299bf6814279A6A1411A7e866A631";
    const anyAddress2 = "0x2409ed021d9299bf6814279a6a1411a7e866a631";
    const zeroAddress = "0x0000000000000000000000000000000000000000";

    let relayHub;
    let gsnForwarder;
    let gsnSponsor;

    let ephemeralOperator;
    let relay = accounts[0];
    let attacker = accounts[5];

    let whitelistFactory;
    let vaultFactory;

    let gatekeeper;
    let bypassModule;

    before(async function () {

        relayHub = await RelayHub.new();
        gsnSponsor = await FreeRecipientSponsor.new();
        gsnForwarder = await GsnForwarder.new(relayHub.address, gsnSponsor.address);
        vaultFactory = await VaultFactory.new(gsnForwarder.address, relayHub.address);
        whitelistFactory = await WhitelistFactory.new(gsnForwarder.address, relayHub.address);
        ephemeralOperator = RelayClient.newEphemeralKeypair();
        await relayHub.stake(relay, 1231231, {from: accounts[2], value: 1e18});
        await relayHub.registerRelay(0, "any:url", {from: relay});
        await relayHub.depositFor(gsnForwarder.address, {from: accounts[2], value: 1e18});

        Object.keys(VaultFactory.events).forEach(function (topic) {
            RelayHub.network.events[topic] = VaultFactory.events[topic];
        });
    });

    it("should sponsor creation of a vault", async function () {
        // Create a double-meta-transaction (clients should use a Web3.js provider from gsn-sponsor package instead)
        let newVaultCallData = vaultFactory.contract.methods.newVault().encodeABI();
        let encodedFunctionCall = gsnForwarder.contract.methods.callRecipient(vaultFactory.address, newVaultCallData).encodeABI();

        let from = ephemeralOperator.address;
        let recipient = gsnForwarder.address;
        let transactionFee = 1;
        let gasPrice = 1;
        let gasLimit = 5253380;
        let nonce = 0;
        let hash = GsnUtils.getTransactionHash(
            from, recipient, encodedFunctionCall, transactionFee,
            gasPrice, gasLimit, nonce, relayHub.address, relay);
        let signature = GsnUtils.getTransactionSignatureWithKey(ephemeralOperator.privateKey, hash);
        let approvalData = [];
        let receipt = await relayHub.relayCall(from, recipient, encodedFunctionCall, transactionFee, gasPrice, gasLimit, nonce, signature, approvalData, {from: relay, gasLimit: 1e10});
        let createdEvent = receipt.logs[0];
        assert.equal(createdEvent.event, "VaultCreated");
        assert.equal(createdEvent.args.sender.toLowerCase(), ephemeralOperator.address);
        gatekeeper = createdEvent.args.gatekeeper;
        assert.notEqual(gatekeeper, zeroAddress); // TODO: no sense to use 'not equal' in JS

    });

    it.skip("should prevent an attacker from intercepting a deployed uninitialized vault", async function () {

    });

    it.skip("should sponsor creation of a bypass module", async function () {
        bypassModule =
            await whitelistFactory.contract.methods.newWhitelist(gatekeeper, [anyAddress1, anyAddress2]).encodeABI();

    });

    it.skip("should sponsor initialization of a vault with valid configuration and bypass modules", async function () {

        //     bytes32[] memory initialParticipants,
        //     uint256[] memory initialDelays,
        //     address _trustedForwarder,
        //     address _relayHub,
        //     bool _allowAcceleratedCalls,
        //     bool _allowAddOperatorNow
        //     address[] bypassTargets,
        //     bytes4[] bypassMethods,
        //     address[] bypassModules
        let initialParticipants = [ephemeralOperator.address];
        let initialDelays = [1];
        let _allowAcceleratedCalls;
        let _allowAddOperatorNo;
        let bypassTargets;
        let bypassMethods;
        let bypassModule;
    });
});