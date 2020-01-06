/* global artifacts web3 contract before it assert */

const Chai = require('chai')
const Web3 = require('web3')

const RelayHub = artifacts.require('./RelayHub.sol')
const Gatekeeper = artifacts.require('./SmartAccount.sol')
const MockGsnForwarder = artifacts.require('./MockGsnForwarder')
const ChangeType = require('./etc/ChangeType')

const Participant = require('../src/js/Participant')
const utils = require('../src/js/SafeChannelUtils')

const expect = Chai.expect

Chai.use(require('ethereum-waffle').solidity)
Chai.use(require('bn-chai')(web3.utils.toBN))

contract('GSN and Sponsor integration', async function (accounts) {
  let gatekeeper
  let relayServer
  let gsnForwarder
  let nonParticipant
  let operatorA
  let ownerPermissions
  let actions
  let args
  let web3
  let hub

  async function nonce () {
    return parseInt(await gatekeeper.stateNonce())
  }

  before(async function () {
    hub = await RelayHub.new()
    gsnForwarder = await MockGsnForwarder.new(hub.address)
    gatekeeper = await Gatekeeper.new({ gas: 8e6 })
    await gatekeeper.ctr2(gsnForwarder.address, accounts[0])
    web3 = new Web3(gatekeeper.contract.currentProvider)
    ownerPermissions = utils.bufferToHex(await gatekeeper.ownerPermissions())
    operatorA = new Participant(accounts[0], ownerPermissions, 1, 'operatorA')
    nonParticipant = new Participant(accounts[1], ownerPermissions, 1, 'operatorA')
    const dummyAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
    relayServer = { address: dummyAddress }
    actions = [ChangeType.ADD_PARTICIPANT]
    args = [utils.encodeParticipant(operatorA)]
    const minuteInSec = 60
    const hourInSec = 60 * minuteInSec
    const dayInSec = 24 * hourInSec
    const initialDelays = Array.from({ length: 10 }, (x, i) => (i + 1) * dayInSec)
    await gatekeeper.initialConfig(args, initialDelays, true, true, [0, 0, 0], [], [], [])
  })

  it('should accept a relayed call if it comes from a valid participant', async function () {
    const calldata = gatekeeper.contract.methods.changeConfiguration(operatorA.permLevel, actions, args, args, await nonce()).encodeABI()

    // Call to acceptRelayedCall is performed by either the RelayHub, or a trusted GSNForwarder, so 'from' field is reliable
    // I know that gas-related params do not matter, so there is no need to test them now
    const result = await gatekeeper.acceptRelayedCall(relayServer.address, operatorA.address, calldata, 0, 0, 0, 0, [], 0)

    assert.equal('0', result[0].toString())
    assert.equal(null, result[1])
  })

  it("should reject a relayed call if it doesn't come from a participant", async function () {
    const calldata = gatekeeper.contract.methods.changeConfiguration(operatorA.permLevel, actions, args, args, await nonce()).encodeABI()

    // I know that gas-related params do not matter, so there is no need to test them now
    const result = await gatekeeper.acceptRelayedCall(relayServer.address, nonParticipant.address, calldata, 0, 0, 0, 0, [], 0)

    assert.equal('11', result[0].toString())
    assert.equal('Not a participant', web3.utils.toAscii(result[1]))
  })

  it('should execute a schedule operation when called via the GSN', async function () {
    const calldata = gatekeeper.contract.methods.changeConfiguration(operatorA.permLevel, actions, args, args, await nonce()).encodeABI()

    const res = await gsnForwarder.mockCallRecipient(operatorA.address, gatekeeper.address, calldata, { gas: 5e6 })
    const decodedLogs = Gatekeeper.decodeLogs(res.receipt.rawLogs)
    assert.equal(decodedLogs[0].event, 'ConfigPending')
  })

  it("should revert a relayed call if it doesn't come from a trusted GSN Forwarder", async function () {
    const calldata = gatekeeper.contract.methods.changeConfiguration(operatorA.permLevel, actions, args, args, await nonce()).encodeABI()

    await expect(
      gsnForwarder.mockCallRecipient(nonParticipant.address, gatekeeper.address, calldata)
    ).to.be.revertedWith('not participant')
  })

  it("should revert a relayed call if it doesn't come from a valid participant", async function () {
    const calldata = gatekeeper.contract.methods.changeConfiguration(operatorA.permLevel, actions, args, args, await nonce()).encodeABI()
    await expect(
      gsnForwarder.mockCallRecipient(nonParticipant.address, gatekeeper.address, calldata)
    ).to.be.revertedWith('not participant')
  })
})
