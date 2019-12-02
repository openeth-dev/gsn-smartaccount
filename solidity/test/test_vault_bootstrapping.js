/* npm modules */
const ethUtils = require('ethereumjs-util');
const ABI = require('ethereumjs-abi');
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
    const anyTarget1 = "0x9409ed021d9299bf6814279a6a1411a7e866a631";
    const anyTarget2 = "0x7409ed021d9299bf6814279a6a1411a7e866a631";
    const zeroAddress = "0x0000000000000000000000000000000000000000";

    let relayHub;
    let gsnForwarder;
    let gsnSponsor;

    let ephemeralOperator;
    let relay = accounts[0];
    let vfOwner = accounts[1];
    let attacker = accounts[5];

    let whitelistFactory;
    let vaultFactory;

    let erc20;
    let gatekeeper;
    let bypassModule;

    function fixSigFormat( buf) {
        return Buffer.concat([buf.slice(1,33), buf.slice(33, buf.length), Buffer.from(buf[0].toString(16),"hex")]);
    }

    function padIntTo32ByteHex(num) {
        return "0".repeat(64 - num.toString(16).length) + num.toString(16)
    }

    async function callViaRelayHub(encodedFunctionCall, nonce, approvalData = []) {
        let from = ephemeralOperator.address;
        let recipient = gsnForwarder.address;
        let transactionFee = 1;
        let gasPrice = 1;
        let gasLimit = 6e6;
        let hash = GsnUtils.getTransactionHash(
            from, recipient, encodedFunctionCall, transactionFee,
            gasPrice, gasLimit, nonce, relayHub.address, relay);
        let signature = GsnUtils.getTransactionSignatureWithKey(ephemeralOperator.privateKey, hash);
        return await relayHub.relayCall(
            from, recipient, encodedFunctionCall, transactionFee, gasPrice, gasLimit, nonce, signature, approvalData,
            {
                from: relay,
                gasLimit: 1e10
            });
    }

    before(async function () {
        erc20 = await DAI.new();
        relayHub = await RelayHub.new();
        gsnSponsor = await FreeRecipientSponsor.new();
        gsnForwarder = await GsnForwarder.new(relayHub.address, gsnSponsor.address);
        vaultFactory = await VaultFactory.new(gsnForwarder.address, {gas: 9e6, from:vfOwner});
        whitelistFactory = await WhitelistFactory.new(gsnForwarder.address);
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
        let vaultId = Buffer.from("a3a6839853586edc9133e9c71d4ccfac678b4fc3f5475fd3014845ad5287870f","hex"); //crypto.randomBytes(32)
        let newVaultCallData = vaultFactory.contract.methods.newVault(vaultId).encodeABI();
        let encodedFunctionCall =
            gsnForwarder.contract.methods.callRecipient(vaultFactory.address, newVaultCallData).encodeABI();

        let timestamp = Buffer.from(Math.floor(Date.now()/1000).toString(16), "hex");//1575229433
        // let timestamp = Buffer.from(padIntTo32ByteHex(timestampInt),"hex");
        //let backendSignature = crypto.randomBytes(65);
        // backendSignature[0] = 0x1b;
        // Mocking backed signature
        let backendSignature = Buffer.from("1b403b57c556f419306af87f80bed54e4358f323a806e9ef35f5b4c77b77a34ac467a020cff280c045518b098409d6ad4924dd1eaa90c70c0a9298f7665a444b68","hex")
        let hash = ABI.soliditySHA3(["bytes32", "bytes4"], [vaultId, timestamp]);
        let signer = ethUtils.bufferToHex(ethUtils.pubToAddress(ethUtils.ecrecover(
            hash, backendSignature[0], backendSignature.slice(1,33), backendSignature.slice(33,backendSignature.length))));
        // Adding mocked signer as trusted caller i.e. backend ethereum address
        await vaultFactory.addTrustedSigners([signer],{from:vfOwner});
        // let approvalData = Buffer.concat([timestamp, fixSigFormat(backendSignature)]);
        let approvalData = ABI.rawEncode(["bytes4", "bytes"], [timestamp, fixSigFormat(backendSignature)]);

        // console.log("vaultId = ", vaultId.toString("hex"))
        // console.log("timestamp = ", timestamp.toString("hex"))
        // console.log("hash = ", hash.toString("hex"))
        // console.log("blockchain hash = ", await vaultFactory.getMessageHash(vaultId, timestamp))
        // console.log("backendSignature = ", backendSignature.toString("hex"))
        // console.log("fixed backendSignature = ", fixSigFormat(backendSignature).toString("hex"))
        // console.log("signer = ", signer)
        // console.log("blockchain signer = ", await vaultFactory.getApprovedSigner(hash, fixSigFormat(backendSignature)))
        // console.log("is approved signer?  ", await vaultFactory.isApprovedSigner(hash, fixSigFormat(backendSignature)))
        // console.log("approvalData = ", approvalData.toString("hex"))

        let receipt = await callViaRelayHub(encodedFunctionCall, 0, approvalData);
        let createdEvent = receipt.logs[0];
        assert.equal(createdEvent.event, "VaultCreated");
        assert.equal(createdEvent.args.sender.toLowerCase(), ephemeralOperator.address);
        assert.equal(web3.utils.isAddress(createdEvent.args.gatekeeper), true);
        assert.notEqual(createdEvent.args.gatekeeper, zeroAddress);
        gatekeeper = await Gatekeeper.at(createdEvent.args.gatekeeper);

    });

    it("should prevent an attacker from intercepting a deployed uninitialized vault", async function () {
        await expect(
            gatekeeper.initialConfig([attacker], [86400], true, true, [0, 0, 0], [], [], [], {from: attacker})
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
        assert.equal(web3.utils.isAddress(createdEvent.args.module), true);
        assert.notEqual(createdEvent.args.module, zeroAddress);
        bypassModule = await WhitelistBypassPolicy.at(createdEvent.args.module);
    });

    it("should sponsor initialization of a vault with valid configuration and bypass modules", async function () {

        let targetsForModule = [anyTarget1, anyTarget2];
        let erc20Transfer = erc20.contract.methods.transfer(zeroAddress, 0).encodeABI().substring(0, 10);
        let erc20Approve = erc20.contract.methods.approve(zeroAddress, 0).encodeABI().substring(0, 10);
        let methodSignaturesForModule = [erc20Transfer, erc20Approve];
        let modules = [anyAddress1, anyAddress2, bypassModule.address, anyTarget2];

        let initialConfigCallData =
            gatekeeper.contract.methods.initialConfig(
                [attacker],
                [86400],
                true,
                true,
                [0, 0, 0],
                targetsForModule,
                methodSignaturesForModule,
                modules
            ).encodeABI();
        let encodedFunctionCall =
            gsnForwarder.contract.methods.callRecipient(gatekeeper.address, initialConfigCallData).encodeABI();

        let receipt = await callViaRelayHub(encodedFunctionCall, 2);
        let createdEvent = receipt.logs[0];
        assert.equal(createdEvent.event, "GatekeeperInitialized");

        let targetModule1 = await gatekeeper.bypassPoliciesByTarget(anyTarget1);
        let targetModule2 = await gatekeeper.bypassPoliciesByTarget(anyTarget2);
        assert.equal(targetModule1.toLowerCase(), anyAddress1.toLowerCase());
        assert.equal(targetModule2.toLowerCase(), anyAddress2.toLowerCase());

        let methodsModule1 = await gatekeeper.bypassPoliciesByMethod(erc20Transfer);
        let methodsModule2 = await gatekeeper.bypassPoliciesByMethod(erc20Approve);
        assert.equal(methodsModule1.toLowerCase(), bypassModule.address.toLowerCase());
        assert.equal(methodsModule2.toLowerCase(), anyTarget2.toLowerCase());
    });
});