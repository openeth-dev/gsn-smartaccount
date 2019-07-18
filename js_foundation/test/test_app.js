const sinon = require("sinon");
const {assert, expect} = require('chai');
const fs = require('fs');

const Web3 = require('web3');
const TruffleContract = require("truffle-contract");

const Interactor = require("../src/js/index.js");

context('VaultContractInteractor Integration Test', function () {
    let ethNodeUrl = 'http://localhost:8545';
    let vaultFactoryAddress;
    let web3;
    let accounts;

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
        console.log("aaa");
        let vaultFactory = await vaultFactoryContract.new({from: accounts[0]});
        vaultFactoryAddress = vaultFactory.address;
    });

    // write tests are quite boring as each should be just a wrapper around a Web3 operation, which
    // is tested in 'solidity' project to do what it says correctly

    context("creation of new vault", function () {
        it("deploys a new vault, but only if not initialized", async function () {
            let interactor = await Interactor.connect(accounts[0], ethNodeUrl, undefined, undefined, vaultFactoryAddress);
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
            assert.fail()
        });

        it("the newly deployed vault should accept the initial configuration", async function () {
            assert.fail()
        });

    });

    it("can schedule to change participants in the vault and later apply it", async function () {
        assert.fail()
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