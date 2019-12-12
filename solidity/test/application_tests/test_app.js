const {assert, expect} = require('chai');
const fs = require('fs');

const Web3 = require('web3');
const TruffleContract = require("truffle-contract");

const safeChannelUtils = require("../../src/js/SafeChannelUtils");
const Participant = require("../../src/js/Participant");

const Interactor = require("../../src/js/VaultContractInteractor.js");
const FactoryInteractor = require("../../src/js/FactoryContractInteractor.js");
const ParticipantAddedEvent = require("../../src/js/events/ParticipantAddedEvent");
const ParticipantRemovedEvent = require("../../src/js/events/ParticipantRemovedEvent");
const OwnerChangedEvent = require("../../src/js/events/OwnerChangedEvent");
const LevelFrozenEvent = require("../../src/js/events/LevelFrozenEvent");

const TransactionReceipt = require("../../src/js/TransactionReceipt");
const ConfigurationDelta = require("../../src/js/ConfigurationDelta");
const PermissionsModel = require("../../src/js/PermissionsModel");

// Skipping - was not maintained, not entirely relevant.
context.skip('VaultContractInteractor Integration Test', function () {
    let ethNodeUrl = 'http://localhost:8545';
    let vaultFactoryAddress;
    let web3;
    let accounts;
    let interactor;
    let factoryInteractor;

    let account23 = "0xcdc1e53bdc74bbf5b5f715d6327dca5785e228b4";

    let expectedUnfreezeOperation = "0x" +
        "0000000000000000000000000000000000000000000000000000000000000044" + // length
        "34cef0f1" + // keccak("unfreeze...")
        "00000000000000000000000090f8bf6a479f320ead074411a4b0e7944ea8c9c1" + // sender
        "0000000000000000000000000000000000000000000000000000000000000d3f";  // permLevel

    let expectedUnfreezeSignature = "0x" +
        "9ff890ec63d0b07099892bda49d21e59797204b8ddafd9c03f79f3df68069eef" + // R
        "2698fa61dae5644ab6f9a2af59da9f9447d7c41c35ca9633db0bf2b0ad0ed872" + // S
        "1c"; // V

    let fund = 1000000;

    let operatorA;
    let operatorB;
    let admin23 = new Participant(account23, PermissionsModel.getAdminPermissions(), 1, "admin23");
    let admin_level2_acc2;

    let getNetworkId = async function () {

        return new Promise((resolve, reject) => {
            web3.currentProvider.send({
                jsonrpc: "2.0",
                method: "net_version",
                params: [],
                id: 0
            }, (err, res) => {
                if (err) return reject(err);
                resolve(res)
            });
        })
    };

    before(async function () {
        let provider = new Web3.providers.HttpProvider(ethNodeUrl);
        web3 = new Web3(provider);
        accounts = await web3.eth.getAccounts();
        operatorA = new Participant(accounts[0], PermissionsModel.getOwnerPermissions(), 1, "operatorA");
        operatorB = new Participant(accounts[1], PermissionsModel.getOwnerPermissions(), 1, "operatorA");
        admin_level2_acc2 = new Participant(accounts[2], PermissionsModel.getAdminPermissions(), 2, "admin_level2_acc2");
        let utilitiesABI = require('../../src/js/generated/Utilities');
        let utilitiesBin = fs.readFileSync("./src/js/generated/Utilities.bin");
        let utilitiesContract = TruffleContract({
            // TODO: calculate this value
            // NOTE: this string is later passed to a regex constructor when resolving, escape everything
            contractName: "\\$7e3e5a7c0842c8a92aaa4508b6debdcba8\\$",
            abi: utilitiesABI,
            binary: utilitiesBin,
            // address: smartAccountFactoryAddress
        });
        utilitiesContract.setProvider(provider);
        let utilitiesLibrary = await utilitiesContract.new({from: accounts[0]});
        utilitiesContract.address = utilitiesLibrary.address;
        let vaultFactoryABI = require('../../src/js/generated/VaultFactory');
        let vaultFactoryBin = fs.readFileSync("./src/js/generated/VaultFactory.bin");
        let vaultFactoryContract = TruffleContract({
            contractName: "VaultFactory",
            abi: vaultFactoryABI,
            binary: vaultFactoryBin,
            // address: smartAccountFactoryAddress
        });
        vaultFactoryContract.setNetwork(utilitiesContract.network_id);
        vaultFactoryContract.link(utilitiesContract);
        vaultFactoryContract.setProvider(provider);
        let vaultFactory = await vaultFactoryContract.new({from: accounts[0]});
        vaultFactoryAddress = vaultFactory.address;
        let credentials = {
            getAddress() {
                return accounts[0]
            }
        };
        let networkId = (await getNetworkId()).result;
        factoryInteractor = await FactoryInteractor.connect(credentials, vaultFactoryAddress, ethNodeUrl, networkId);
    });

    // write tests are quite boring as each should be just a wrapper around a Web3 operation, which
    // is tested in 'solidity' project to do what it says correctly

    context("creation of new smartAccount by a smartAccount factory interactor", function () {
        it("should deploy a new smartAccount", async function () {
            // Compares the return value of the 'deploy' function with the actual event in that block
            let deploymentResult = await factoryInteractor.deployNewSmartAccount();
            let initialConfigEvent = await factoryInteractor.getSmartAccountCreatedEvent({fromBlock: deploymentResult.blockNumber, toBlock: deploymentResult.blockNumber});
            assert.equal(deploymentResult.vault, initialConfigEvent.smartAccount);
            assert.equal(deploymentResult.sender, initialConfigEvent.sender);
            assert.equal(deploymentResult.gatekeeper, initialConfigEvent.gatekeeper);
        });
    });

// expect(err).to.have.property('message', 'smartAccount already deployed');
    context("interactor with a deployed smartAccount", function () {
        before(async function () {
            let deploymentResult = await factoryInteractor.deployNewSmartAccount();
            interactor = await Interactor.connect(
                accounts[0],
                PermissionsModel.getOwnerPermissions(),
                1,
                ethNodeUrl,
                deploymentResult.gatekeeper,
                deploymentResult.vault);
        });

        it("the newly deployed smartAccount should handle having no configuration", async function () {
            let operator = await interactor.getOperator();
            assert.equal(operator, null);
            let delays = await interactor.getDelays();
            assert.equal(delays.length, 0);
            let initializedEvent = await interactor.getGatekeeperInitializedEvent();
            assert.equal(initializedEvent, null);
            let addedEvents = await interactor.getParticipantAddedEvents();
            assert.equal(addedEvents.length, 0);
            let removedEvents = await interactor.getParticipantRemovedEvents();
            assert.equal(removedEvents.length, 0);
            let ownerEvents = await interactor.getOwnerChangedEvents();
            assert.equal(ownerEvents.length, 0);
            let freezeParams = await interactor.getFreezeParameters();
            assert.deepEqual(freezeParams, {frozenLevel: 0, frozenUntil: 0});
        });

        it("the newly deployed smartAccount should accept the initial configuration", async function () {
            let anyAdmin = "0x" + safeChannelUtils.participantHash(account23, safeChannelUtils.packPermissionLevel(PermissionsModel.getAdminPermissions(), 1)).toString('hex');
            let participantsHashes = [
                anyAdmin,
                "0xbb",
                "0xcc",
            ];
            let delaysExpected = [1, 2, 3];
            await interactor.initialConfig({
                participants:
                participantsHashes,
                delays:
                delaysExpected
            });

            let initEvent = await interactor.getGatekeeperInitializedEvent();
            let expectedHashes = participantsHashes.map(function (hash) {
                return hash.padEnd(66, '0')
            });
            assert.deepEqual(initEvent.participantsHashes, expectedHashes);

            let operator = await interactor.getOperator();
            assert.equal(operator, accounts[0]);

            let delays = await interactor.getDelays();
            assert.deepEqual(delays, delaysExpected);

        });

    });

    context("using initialized and configured smartAccount", function () {

        before(async function () {
            let deploymentResult = await factoryInteractor.deployNewSmartAccount();
            interactor = await Interactor.connect(
                accounts[0],
                PermissionsModel.getOwnerPermissions(),
                1,
                ethNodeUrl,
                deploymentResult.gatekeeper,
                deploymentResult.vault);
            // TODO: set desired configuration here
            await web3.eth.sendTransaction({from: accounts[0], to: interactor.smartAccount.address, value: fund});
        });

        it.skip("can schedule to change participants in the smartAccount and later apply it", async function () {
            let participants = [
                operatorA.expect(),
                admin23.expect(),
                admin_level2_acc2];
            await safeChannelUtils.validateConfigParticipants(participants, interactor.gatekeeper);

            let permLevelToRemove = safeChannelUtils.packPermissionLevel(PermissionsModel.getAdminPermissions(), 1);
            let change = new ConfigurationDelta([
                    {
                        address: admin_level2_acc2.address,
                        permissions: admin_level2_acc2.permissions,
                        level: admin_level2_acc2.level
                    }
                ],
                [
                    {hash: safeChannelUtils.participantHash(account23, permLevelToRemove)}
                ]);
            let receipt1 = await interactor.changeConfiguration(change);
            let blockOptions = {
                fromBlock: receipt1.blockNumber,
                toBlock: receipt1.blockNumber
            };
            // values here are not deterministic. I can only check they exist.
            assert.equal(receipt1.blockHash.length, 66);
            assert.equal(receipt1.transactionHash.length, 66);
            assert.isAbove(receipt1.blockNumber, 0);
            assert.isAbove(receipt1.gasUsed, 21000);

            let delayedOpEvents = await interactor.getDelayedOperationsEvents(blockOptions);
            assert.equal(delayedOpEvents.length, 1);

            let delays = await interactor.getDelays();
            let time = delays[1] + 100;
            // TODO: fix when delay per level is implemented
            await safeChannelUtils.increaseTime(1000 * 60 * 60 * 24, web3);

            let receipt2 = await interactor.applyBatch(delayedOpEvents[0].operation, delayedOpEvents[0].opsNonce);
            blockOptions = {
                fromBlock: receipt2.blockNumber,
                toBlock: receipt2.blockNumber
            };
            let addedEvents = await interactor.getParticipantAddedEvents(blockOptions);
            assert.equal(addedEvents.length, 1);
            participants = [
                operatorA.expect(),
                admin23,
                admin_level2_acc2.expect()];
            await safeChannelUtils.validateConfigParticipants(participants, interactor.gatekeeper);

        });

        it.skip("can freeze and unfreeze", async function () {
            let receipt1 = await interactor.freeze(1, 1000);
            let levelFrozenEvents = await interactor.getLevelFrozenEvents(
                {
                    fromBlock: receipt1.blockNumber,
                    toBlock: receipt1.blockNumber
                });
            assert.equal(levelFrozenEvents.length, 1);

            let freezeParameters = await interactor.getFreezeParameters();


            let block = await web3.eth.getBlock(receipt1.blockNumber);
            let expectedFrozenUntil = block.timestamp + 1000;

            // check that event and contract state are correct and consistent
            assert.equal(levelFrozenEvents[0].frozenLevel, 1);
            assert.equal(levelFrozenEvents[0].frozenUntil, expectedFrozenUntil);
            assert.equal(freezeParameters.frozenLevel, 1);
            assert.equal(freezeParameters.frozenUntil, expectedFrozenUntil);

            let signedRequest = await interactor.signBoostedConfigChange({unfreeze: true});
            assert.equal(signedRequest.operation, expectedUnfreezeOperation);
            assert.equal(signedRequest.signature, expectedUnfreezeSignature);

            // To unfreeze, need to create a different 'interactor' - used by the admin of a higher level
            let adminsInteractor = await Interactor.connect(
                admin_level2_acc2.address,
                admin_level2_acc2.permissions,
                admin_level2_acc2.level,
                ethNodeUrl,
                interactor.gatekeeper.address,
                interactor.smartAccount.address,
                vaultFactoryAddress
            );
            let receipt2 = await adminsInteractor.scheduleBoostedConfigChange({
                operation: signedRequest.operation,
                signature: signedRequest.signature,
                signerPermsLevel: operatorA.permLevel
            });

            let delayedOpEvents = await interactor.getDelayedOperationsEvents({
                fromBlock: receipt2.blockNumber,
                toBlock: receipt2.blockNumber
            });
            assert.equal(delayedOpEvents.length, 1);
            // TODO: fix when delay per level is implemented
            await safeChannelUtils.increaseTime(1000 * 60 * 60 * 24, web3);
            let receipt3 = await interactor.applyBatch(delayedOpEvents[0].operation, delayedOpEvents[0].opsNonce, admin_level2_acc2);

            let unfreezeCompleteEvents = await interactor.getUnfreezeCompletedEvents(
                {
                    fromBlock: receipt3.blockNumber,
                    toBlock: receipt3.blockNumber
                });

            assert.equal(unfreezeCompleteEvents.length, 1);

            let freezeParameters2 = await interactor.getFreezeParameters();
            assert.deepEqual(freezeParameters2, {frozenLevel: 0, frozenUntil: 0});
        });

        it.skip("can transfer different types of assets", async function () {
            let ethBalance = await interactor.getBalance();
            assert.equal(ethBalance, fund);
            let receipt1 = await interactor.sendEther({destination: accounts[5], value: 1000});
            ethBalance = await interactor.getBalance();
            assert.equal(ethBalance, fund);

            let delayedOpEvents = await interactor.getDelayedOperationsEventsForVault({
                fromBlock: receipt1.blockNumber,
                toBlock: receipt1.blockNumber
            });

            assert.equal(delayedOpEvents.length, 1);
            // TODO: fix when delay per level is implemented
            await safeChannelUtils.increaseTime(1000 * 60 * 60 * 24, web3);
            await interactor.applyTransfer({
                operation: delayedOpEvents[0].operation,
                nonce: delayedOpEvents[0].opsNonce
            });
            ethBalance = await interactor.getBalance();
            assert.equal(ethBalance, fund - 1000);

        });

        it.skip("can change owner", async function () {
            let receipt1 = await interactor.scheduleChangeOwner(operatorB.address);
            let delayedOpEvents = await interactor.getDelayedOperationsEvents({
                fromBlock: receipt1.blockNumber,
                toBlock: receipt1.blockNumber
            });
            assert.equal(delayedOpEvents.length, 1);

            // TODO: fix when delay per level is implemented
            await safeChannelUtils.increaseTime(1000 * 60 * 60 * 24, web3);
            let receipt2 = await interactor.applyBatch(delayedOpEvents[0].operation, delayedOpEvents[0].opsNonce);

            let ownerChangedEvents = await interactor.getOwnerChangedEvents(
                {
                    fromBlock: receipt2.blockNumber,
                    toBlock: receipt2.blockNumber
                });
            assert.equal(ownerChangedEvents.length, 1);
            let participants = [
                operatorA,
                operatorB.expect(),
                admin23,
                admin_level2_acc2.expect()];
            await safeChannelUtils.validateConfigParticipants(participants, interactor.gatekeeper);
        });


        // ****** read tests

        context.skip("reading directly from the contract's state", function () {
            it("read operator", async function () {
                assert.fail()
            });
            it("read balances", async function () {
                assert.fail()
            });
        });


        context.skip("reading by parsing the event logs", function () {
            it("read participant hashes", async function () {
                assert.fail()
            });
        });
    });
});