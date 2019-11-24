/* npm modules */
const Chai = require('chai');
const GsnUtils = require('tabookey-gasless/src/js/relayclient/utils');
const RelayClient = require('tabookey-gasless/src/js/relayclient/RelayClient');

/* truffle artifacts */
const DAI = artifacts.require("./DAI.sol");
const Gatekeeper = artifacts.require("./Gatekeeper.sol");

const RelayHub = artifacts.require("RelayHub");
const VaultFactory = artifacts.require("VaultFactory");
const GsnForwarder = artifacts.require("GsnForwarder");
const WhitelistFactory = artifacts.require("WhitelistFactory");
const FreeRecipientSponsor = artifacts.require("FreeRecipientSponsor");
const WhitelistBypassPolicy = artifacts.require("WhitelistBypassPolicy");

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

    async function callViaRelayHub(encodedFunctionCall, nonce) {
        let from = ephemeralOperator.address;
        let recipient = gsnForwarder.address;
        let transactionFee = 1;
        let gasPrice = 1;
        let gasLimit = 5253380;
        let hash = GsnUtils.getTransactionHash(
            from, recipient, encodedFunctionCall, transactionFee,
            gasPrice, gasLimit, nonce, relayHub.address, relay);
        let signature = GsnUtils.getTransactionSignatureWithKey(ephemeralOperator.privateKey, hash);
        let approvalData = [];
        return await relayHub.relayCall(
            from, recipient, encodedFunctionCall, transactionFee, gasPrice, gasLimit, nonce, signature, approvalData,
            {
                from: relay,
                gasLimit: 1e10
            });
    }

    before(async function () {

        relayHub = await RelayHub.new();
        gsnSponsor = await FreeRecipientSponsor.new();
        gsnForwarder = await GsnForwarder.new(relayHub.address, gsnSponsor.address);
        vaultFactory = await VaultFactory.new(gsnForwarder.address, relayHub.address, {gas:8e6});
        whitelistFactory = await WhitelistFactory.new(gsnForwarder.address, relayHub.address);
        ephemeralOperator = RelayClient.newEphemeralKeypair();
        await relayHub.stake(relay, 1231231, {from: accounts[2], value: 1e18});
        await relayHub.registerRelay(0, "any:url", {from: relay});
        await relayHub.depositFor(gsnForwarder.address, {from: accounts[2], value: 1e18});

        Object.keys(VaultFactory.events).forEach(function (topic) {
            RelayHub.network.events[topic] = VaultFactory.events[topic];
        });
        Object.keys(WhitelistFactory.events).forEach(function (topic) {
            RelayHub.network.events[topic] = WhitelistFactory.events[topic];
        });
        Object.keys(Gatekeeper.events).forEach(function (topic) {
            RelayHub.network.events[topic] = Gatekeeper.events[topic];
        });
    });

    it("should sponsor creation of a vault", async function () {
        // Create a double-meta-transaction (clients should use a Web3.js provider from gsn-sponsor package instead)
        let newVaultCallData = vaultFactory.contract.methods.newVault().encodeABI();
        let encodedFunctionCall =
            gsnForwarder.contract.methods.callRecipient(vaultFactory.address, newVaultCallData).encodeABI();

        let receipt = await callViaRelayHub(encodedFunctionCall, 0);
        let createdEvent = receipt.logs[0];
        assert.equal(createdEvent.event, "VaultCreated");
        assert.equal(createdEvent.args.sender.toLowerCase(), ephemeralOperator.address);
        assert.notEqual(createdEvent.args.gatekeeper, zeroAddress); // TODO: no sense to use 'not equal' in JS
        gatekeeper = await Gatekeeper.at(createdEvent.args.gatekeeper);

    });

    it("should prevent an attacker from intercepting a deployed uninitialized vault", async function () {
        await expect(
            gatekeeper.initialConfig([attacker], [86400], true, true, [0, 0, 0], {from: attacker})
        ).to.be.revertedWith("initialConfig must be called by creator");
    });

    it("should sponsor creation of a bypass module", async function () {
        let newBypassModuleCallData =
            whitelistFactory.contract.methods.newWhitelist(gatekeeper.address, [anyAddress1, anyAddress2]).encodeABI();
        let encodedFunctionCall =
            gsnForwarder.contract.methods.callRecipient(whitelistFactory.address, newBypassModuleCallData).encodeABI();

        let receipt = await callViaRelayHub(encodedFunctionCall, 1);
        let createdEvent = receipt.logs[0];
        assert.equal(createdEvent.event, "WhitelistModuleCreated");
        assert.equal(createdEvent.args.sender.toLowerCase(), ephemeralOperator.address);
        assert.notEqual(createdEvent.args.module, zeroAddress); // TODO: no sense to use 'not equal' in JS
        bypassModule = await WhitelistBypassPolicy.at(createdEvent.args.module);
    });

    it("should sponsor initialization of a vault with valid configuration and bypass modules", async function () {
        let initialConfigCallData =
            gatekeeper.contract.methods.initialConfig([attacker], [86400], true, true, [0, 0, 0]).encodeABI();
        let encodedFunctionCall =
            gsnForwarder.contract.methods.callRecipient(gatekeeper.address, initialConfigCallData).encodeABI();

        let receipt = await callViaRelayHub(encodedFunctionCall, 2);
        let createdEvent = receipt.logs[0];
        assert.equal(createdEvent.event, "GatekeeperInitialized");

        // MODULES!!!
    });

    it("should not allow to initialize vault twice");
});