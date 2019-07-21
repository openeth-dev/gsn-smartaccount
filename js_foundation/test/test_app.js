const sinon = require("sinon");
const {assert, expect} = require('chai');
const fs = require('fs');

const Web3 = require('web3');
const TruffleContract = require("truffle-contract");

const truffleUtils = require("../../solidity/test/utils");

const Interactor = require("../src/js/VaultContractInteractor.js");
const ParticipantAddedEvent = require("../src/js/events/ParticipantAddedEvent");
const ParticipantRemovedEvent = require("../src/js/events/ParticipantRemovedEvent");
const OwnerChangedEvent = require("../src/js/events/OwnerChangedEvent");
const GatekeeperInitializedEvent = require("../src/js/events/GatekeeperInitializedEvent");

const TransactionReceipt = require("../src/js/TransactionReceipt");
const ConfigurationDelta = require("../src/js/ConfigurationDelta");
const PermissionsModel = require("../src/js/PermissionsModel");

context('VaultContractInteractor Integration Test', function () {
    let ethNodeUrl = 'http://localhost:8545';
    let vaultFactoryAddress;
    let web3;
    let accounts;
    let interactor;

    let account23 = "0xcdc1e53bdc74bbf5b5f715d6327dca5785e228b4";
    let account24 = "0xf5d1eaf516ef3b0582609622a221656872b82f78";

    before(async function () {
        let provider = new Web3.providers.HttpProvider(ethNodeUrl);
        web3 = new Web3(provider);
        accounts = await web3.eth.getAccounts();
        let vaultFactoryABI = require('../src/js/generated/VaultFactory');
        let vaultFactoryBin = fs.readFileSync("./src/js/generated/VaultFactory.bin");
        let vaultFactoryContract = TruffleContract({
            contractName: "VaultFactory",
            abi: vaultFactoryABI,
            binary: vaultFactoryBin,
            address: vaultFactoryAddress
        });
        vaultFactoryContract.setProvider(provider);
        let vaultFactory = await vaultFactoryContract.new({from: accounts[0]});
        vaultFactoryAddress = vaultFactory.address;
        interactor = await Interactor.connect(accounts[0], ethNodeUrl, undefined, undefined, vaultFactoryAddress);
    });

    // write tests are quite boring as each should be just a wrapper around a Web3 operation, which
    // is tested in 'solidity' project to do what it says correctly

    context("creation of new vault", function () {
        it("deploys a new vault, but only if not initialized", async function () {
            let addressBefore = interactor.getGatekeeperAddress();
            assert.strictEqual(addressBefore, null);

            assert.notExists(interactor.vault);
            assert.notExists(interactor.gatekeeper);
            await interactor.deployNewGatekeeper();
            assert.exists(interactor.vault);
            assert.exists(interactor.gatekeeper);

            try {
                await interactor.deployNewGatekeeper();
                return Promise.reject(new Error('Should have thrown'));
            } catch (err) {
                expect(err).to.have.property('message', 'vault already deployed');
            }
        });

        it("the newly deployed vault should handle having no configuration", async function () {
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
            assert.equal(freezeParams, null);
            let scheduledOperations = await interactor.getScheduledOperations();
            assert.equal(scheduledOperations.length, 0);
        });

        it("the newly deployed vault should accept the initial configuration", async function () {
            let anyAdmin = "0x" + truffleUtils.participantHash(account23, truffleUtils.packPermissionLevel(PermissionsModel.getAdminPermissions(), 1)).toString('hex');
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

    context("using initialized and configured vault", function () {

        before(function () {
            // TODO: fund the vault
        });

        it("can schedule to change participants in the vault and later apply it", async function () {
            let change = new ConfigurationDelta([
                    {address: account24, permissions: PermissionsModel.getAdminPermissions(), level: 1}
                ],
                []);
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
            await truffleUtils.increaseTime(1000 * 60 * 60 * 24, web3);

            let receipt2 = await interactor.applyBatch(delayedOpEvents[0].operation, delayedOpEvents[0].opsNonce);
            blockOptions = {
                fromBlock: receipt2.blockNumber,
                toBlock: receipt2.blockNumber
            };
            let addedEvents = await interactor.getParticipantAddedEvents(blockOptions);
            assert.equal(addedEvents.length, 1)
            // TODO: implement config validation as in truffle project

        });

        it("can freeze and unfreeze", async function () {
            assert.fail()
        });

        it("can change owner", async function () {
            assert.fail()
        });

        it("can transfer different types of assets", async function () {
            assert.fail()
        });


        // ****** read tests

        context("reading directly from the contract's state", function () {
            it("read operator", async function () {
                assert.fail()
            });
            it("read balances", async function () {
                assert.fail()
            });
        });


        context("reading by parsing the event logs", function () {
            it("read participant hashes", async function () {
                assert.fail()
            });
        });
    });
});