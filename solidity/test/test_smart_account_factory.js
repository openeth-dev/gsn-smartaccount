/* global artifacts contract before it assert after */
const SmartAccountFactory = artifacts.require('./SmartAccountFactory.sol')
const SmartAccount = artifacts.require('./SmartAccount.sol')
const BypassLib = artifacts.require('./BypassModules/BypassLib.sol')
const RelayHub = artifacts.require('./RelayHub.sol')
const MockGsnForwarder = artifacts.require('./tests/MockGsnForwarder.sol')

const crypto = require('crypto')
const Chai = require('chai')
const expect = Chai.expect
const forgeApprovalData = require('./utils').forgeApprovalData

contract('SmartAccountFactory', function (accounts) {
  let mockForwarder
  let bypassLib
  let smartAccountTemplate
  let mockHub
  let smartAccountFactory
  let callData
  let smartAccountId
  const zeroAddress = '0x0000000000000000000000000000000000000000'
  const vfOwner = accounts[1]

  before(async function () {
    smartAccountId = crypto.randomBytes(32)
    mockHub = await RelayHub.new({ gas: 9e6 })
    mockForwarder = await MockGsnForwarder.new(mockHub.address, { gas: 9e6 })
    bypassLib = await BypassLib.new({ gas: 8e6 })
    smartAccountTemplate = await SmartAccount.new(bypassLib.address, { gas: 9e6 })
    smartAccountFactory = await SmartAccountFactory.new(mockForwarder.address, smartAccountTemplate.address, bypassLib.address,
      { gas: 9e7, from: vfOwner })
    // Mocking backend signature
    const approvalData = await forgeApprovalData(smartAccountId, smartAccountFactory, vfOwner)
    callData = smartAccountFactory.contract.methods.newSmartAccount(smartAccountId, approvalData).encodeABI()
  })

  it('should deploy SmartAccount', async function () {
    const sender = accounts[0]
    // TODO: this should be 'await smartAccountFactory.newSmartAccount(crypto.randomBytes(32),{from: mockHub})'
    //  once we remove redundant tests inside recipient & forwarder constructors and setters.
    const res = await mockForwarder.mockCallRecipient(sender, smartAccountFactory.address, callData)
    const event = res.logs[0]

    assert.equal(event.event, 'SmartAccountCreated')
    assert.equal(event.args.sender, sender)
    assert.equal(event.args.smartAccountId, '0x' + smartAccountId.toString('hex'))
  })

  it('should revert when deploying with same smartAccountId', async function () {
    await expect(
      mockForwarder.mockCallRecipient(zeroAddress, smartAccountFactory.address, callData)
    ).to.be.revertedWith('SmartAccount already created for this id')
  })

  after('write coverage report', async () => {
    if (global.postCoverage) {
      await global.postCoverage()
    }
  })
})
