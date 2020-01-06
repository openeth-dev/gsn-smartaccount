/* global artifacts web3 contract before it assert */

/* npm modules */
const Chai = require('chai')
const GsnUtils = require('tabookey-gasless/src/js/relayclient/utils')
const RelayClient = require('tabookey-gasless/src/js/relayclient/RelayClient')

/* truffle artifacts */
const DAI = artifacts.require('./DAI.sol')
const SmartAccount = artifacts.require('./SmartAccount.sol')

const RelayHub = artifacts.require('RelayHub')
const SmartAccountFactory = artifacts.require('SmartAccountFactory')
const GsnForwarder = artifacts.require('GsnForwarder')
const WhitelistFactory = artifacts.require('WhitelistFactory')
const FreeRecipientSponsor = artifacts.require('FreeRecipientSponsor')
const WhitelistBypassPolicy = artifacts.require('WhitelistBypassPolicy')

const expect = Chai.expect
const forgeApprovalData = require('./utils').forgeApprovalData
Chai.use(require('ethereum-waffle').solidity)
Chai.use(require('bn-chai')(web3.utils.toBN))

/**
 * A full contracts integration test: relay hub -> forwarder -> sponsor -> factories -> smartAccount.
 * The purpose of this test is to prove that we can create a new smartAccount for
 * our users with a configuration that is needed without unreasonable limitations
 * (like, insecure smartAccount state, multiple delay periods, etc.)
 */
contract('SmartAccount Bootstrapping', async function (accounts) {
  const anyAddress1 = '0x5409ED021D9299bf6814279A6A1411A7e866A631'
  const anyAddress2 = '0x2409ed021d9299bf6814279a6a1411a7e866a631'
  const anyTarget1 = '0x9409ed021d9299bf6814279a6a1411a7e866a631'
  const anyTarget2 = '0x7409ed021d9299bf6814279a6a1411a7e866a631'
  const zeroAddress = '0x0000000000000000000000000000000000000000'

  let relayHub
  let gsnForwarder
  let gsnSponsor

  let ephemeralOperator
  const relay = accounts[0]
  const vfOwner = accounts[1]
  const attacker = accounts[5]

  let whitelistFactory
  let smartAccountFactory

  let erc20
  let smartAccount
  let bypassModule

  async function callViaRelayHub (encodedFunctionCall, nonce, approvalData = []) {
    const from = ephemeralOperator.address
    const recipient = gsnForwarder.address
    const transactionFee = 1
    const gasPrice = 1
    const gasLimit = 6e6
    const hash = GsnUtils.getTransactionHash(
      from, recipient, encodedFunctionCall, transactionFee,
      gasPrice, gasLimit, nonce, relayHub.address, relay)
    const signature = GsnUtils.getTransactionSignatureWithKey(ephemeralOperator.privateKey, hash)

    return relayHub.relayCall(
      from, recipient, encodedFunctionCall, transactionFee, gasPrice, gasLimit, nonce, signature, approvalData,
      {
        from: relay,
        gasLimit: 1e10
      })
  }

  before(async function () {
    erc20 = await DAI.new()
    relayHub = await RelayHub.new()
    gsnSponsor = await FreeRecipientSponsor.new()
    gsnForwarder = await GsnForwarder.new(relayHub.address, gsnSponsor.address)
    await gsnSponsor.setForwarder(gsnForwarder.address)
    smartAccountFactory = await SmartAccountFactory.new(gsnForwarder.address, { gas: 9e7, from: vfOwner })
    await smartAccountFactory.createAccountTemplate({ from: vfOwner })

    whitelistFactory = await WhitelistFactory.new(gsnForwarder.address)
    ephemeralOperator = RelayClient.newEphemeralKeypair()
    await relayHub.stake(relay, 1231231, { from: accounts[2], value: 1e18 })
    await relayHub.registerRelay(0, 'any:url', { from: relay })
    await relayHub.depositFor(gsnForwarder.address, { from: accounts[2], value: 1e18 })

    Object.keys(SmartAccountFactory.events).forEach(function (topic) {
      RelayHub.network.events[topic] = SmartAccountFactory.events[topic]
    })
    Object.keys(WhitelistFactory.events).forEach(function (topic) {
      RelayHub.network.events[topic] = WhitelistFactory.events[topic]
    })
    Object.keys(SmartAccount.events).forEach(function (topic) {
      RelayHub.network.events[topic] = SmartAccount.events[topic]
    })
  })

  it('should sponsor creation of a smartAccount', async function () {
    // Create a double-meta-transaction (clients should use a Web3.js provider from gsn-sponsor package instead)
    const smartAccountId = Buffer.from('a3a6839853586edc9133e9c71d4ccfac678b4fc3f5475fd3014845ad5287870f', 'hex') // crypto.randomBytes(32)
    // Mocking backend signature
    const approvalData = await forgeApprovalData(smartAccountId, smartAccountFactory, vfOwner)
    const newSmartAccountCallData = smartAccountFactory.contract.methods.newSmartAccount(smartAccountId, approvalData).encodeABI()
    const encodedFunctionCall =
      gsnForwarder.contract.methods.callRecipient(smartAccountFactory.address, newSmartAccountCallData).encodeABI()

    const receipt = await callViaRelayHub(encodedFunctionCall, 0, approvalData)
    const createdEvent = receipt.logs[0]
    assert.equal(createdEvent.event, 'SmartAccountCreated')
    assert.equal(createdEvent.args.sender.toLowerCase(), ephemeralOperator.address)
    assert.equal(web3.utils.isAddress(createdEvent.args.smartAccount), true)
    assert.notEqual(createdEvent.args.smartAccount, zeroAddress)
    smartAccount = await SmartAccount.at(createdEvent.args.smartAccount)
  })

  it('should prevent an attacker from intercepting a deployed uninitialized smartAccount', async function () {
    await expect(
      smartAccount.initialConfig([attacker], [86400], true, true, [0, 0, 0], [], [], [], { from: attacker })
    ).to.be.revertedWith('initialConfig must be called by creator')
  })

  it('should sponsor creation of a bypass module', async function () {
    const newBypassModuleCallData =
            whitelistFactory.contract.methods.newWhitelist(smartAccount.address, [anyAddress1, anyAddress2]).encodeABI()
    const encodedFunctionCall =
            gsnForwarder.contract.methods.callRecipient(whitelistFactory.address, newBypassModuleCallData).encodeABI()

    const receipt = await callViaRelayHub(encodedFunctionCall, 1)
    const createdEvent = receipt.logs[0]
    assert.equal(createdEvent.event, 'WhitelistModuleCreated')
    assert.equal(createdEvent.args.sender.toLowerCase(), ephemeralOperator.address)
    assert.equal(web3.utils.isAddress(createdEvent.args.module), true)
    assert.notEqual(createdEvent.args.module, zeroAddress)
    bypassModule = await WhitelistBypassPolicy.at(createdEvent.args.module)
  })

  it('should sponsor initialization of a smartAccount with valid configuration and bypass modules', async function () {
    const targetsForModule = [anyTarget1, anyTarget2]
    const erc20Transfer = erc20.contract.methods.transfer(zeroAddress, 0).encodeABI().substring(0, 10)
    const erc20Approve = erc20.contract.methods.approve(zeroAddress, 0).encodeABI().substring(0, 10)
    const methodSignaturesForModule = [erc20Transfer, erc20Approve]
    const modules = [anyAddress1, anyAddress2, bypassModule.address, anyTarget2]

    const initialConfigCallData =
            smartAccount.contract.methods.initialConfig(
              [attacker],
              [86400],
              true,
              true,
              [0, 0, 0],
              targetsForModule,
              methodSignaturesForModule,
              modules
            ).encodeABI()
    const encodedFunctionCall =
            gsnForwarder.contract.methods.callRecipient(smartAccount.address, initialConfigCallData).encodeABI()

    const receipt = await callViaRelayHub(encodedFunctionCall, 2)
    const createdEvent = receipt.logs[0]
    assert.equal(createdEvent.event, 'SmartAccountInitialized')

    const targetModule1 = await smartAccount.bypassPoliciesByTarget(anyTarget1)
    const targetModule2 = await smartAccount.bypassPoliciesByTarget(anyTarget2)
    assert.equal(targetModule1.toLowerCase(), anyAddress1.toLowerCase())
    assert.equal(targetModule2.toLowerCase(), anyAddress2.toLowerCase())

    const methodsModule1 = await smartAccount.bypassPoliciesByMethod(erc20Transfer)
    const methodsModule2 = await smartAccount.bypassPoliciesByMethod(erc20Approve)
    assert.equal(methodsModule1.toLowerCase(), bypassModule.address.toLowerCase())
    assert.equal(methodsModule2.toLowerCase(), anyTarget2.toLowerCase())
  })
})
